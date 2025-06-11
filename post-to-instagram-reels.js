require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const resultDir = path.join(__dirname, 'result');
const descriptionDir = path.join(__dirname, 'descriptions');
const thumbnailDir = path.join(__dirname, 'thumbnails');
const instagramUserId = process.env.INSTAGRAM_USER_ID;
const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
const ngrokBaseUrl = process.env.NGROK_BASE_URL;
const apiBaseUrl = 'https://graph.instagram.com/v20.0';
const delayBetweenPosts = 60000;

// Validate env
if (!instagramUserId || !accessToken || !ngrokBaseUrl) {
  console.error('Error: Set INSTAGRAM_USER_ID, INSTAGRAM_ACCESS_TOKEN, and NGROK_BASE_URL in .env.');
  process.exit(1);
}

// Ensure directories
async function ensureDirectories() {
  try {
    await fs.access(resultDir);
    await fs.access(descriptionDir);
    await fs.access(thumbnailDir);
  } catch {
    console.error('Directories (result, descriptions, thumbnails) not found.');
    process.exit(1);
  }
}

// Get files
async function getFiles() {
  try {
    const videoFiles = (await fs.readdir(resultDir))
      .filter(file => file.match(/^video_part_\d+\.mp4$/))
      .sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    const parts = [];
    for (const video of videoFiles) {
      const partNumber = video.match(/\d+/)[0];
      const description = `description_part_${partNumber}.txt`;
      const thumbnail = `thumbnail_part_${partNumber}.jpg`;

      try {
        await fs.access(path.join(resultDir, video));
        await fs.access(path.join(descriptionDir, description));
        await fs.access(path.join(thumbnailDir, thumbnail));
        const publicUrl = `${ngrokBaseUrl}/${video}`;
        if (!publicUrl.match(/^https:\/\/.*\.ngrok.*\/video_part_\d+\.mp4$/)) {
          throw new Error(`Invalid ngrok URL for ${video}`);
        }
        parts.push({ video, description, thumbnail, publicUrl });
      } catch (error) {
        console.error(`Skipping part ${partNumber}:`, error.message);
      }
    }
    return parts;
  } catch (error) {
    console.error('Error reading files:', error.message);
    process.exit(1);
  }
}

// Read caption
async function readDescription(descriptionPath) {
  try {
    return (await fs.readFile(descriptionPath, 'utf-8')).trim();
  } catch (error) {
    console.error(`Error reading ${descriptionPath}:`, error.message);
    return '';
  }
}

// Upload Reel
async function uploadReel(videoUrl, caption, partNumber) {
  try {
    const containerResponse = await axios.post(
      `${apiBaseUrl}/${instagramUserId}/media`,
      {
        media_type: 'REELS',
        video_url: videoUrl,
        caption: caption,
        access_token: accessToken
      }
    );

    if (!containerResponse.data.id) {
      throw new Error('Failed to create media container.');
    }
    const containerId = containerResponse.data.id;
    console.log(`Container created for part ${partNumber}: ${containerId}`);

    const publishResponse = await axios.post(
      `${apiBaseUrl}/${instagramUserId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    if (publishResponse.data.id) {
      console.log(`Reel posted for part ${partNumber}: ${publishResponse.data.id}`);
      console.log(`Manually set ${path.join(thumbnailDir, `thumbnail_part_${partNumber}.jpg`)} as cover in Instagram.`);
    } else {
      throw new Error('Failed to publish Reel.');
    }
  } catch (error) {
    console.error(`Error posting part ${partNumber}:`, error.response?.data?.error?.message || error.message);
  }
}

// Delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main
async function main() {
  try {
    console.log('Starting Instagram Reels posting...');
    await ensureDirectories();
    const parts = await getFiles();
    if (parts.length === 0) {
      console.error('No video parts found.');
      process.exit(0);
    }
    console.log(`Found ${parts.length} parts.`);

    for (const part of parts) {
      const partNumber = parseInt(part.video.match(/\d+/)[0]);
      console.log(`Processing Part ${partNumber}...`);

      const descriptionPath = path.join(descriptionDir, part.description);
      const caption = await readDescription(descriptionPath);
      if (!caption) {
        console.error(`Skipping part ${partNumber}: Invalid caption.`);
        continue;
      }

      await uploadReel(part.publicUrl, caption, partNumber);

      if (part !== parts[parts.length - 1]) {
        console.log(`Waiting ${delayBetweenPosts / 1000}s...`);
        await delay(delayBetweenPosts);
      }
    }

    console.log('Posting complete! Set thumbnails manually in Instagram.');
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

main();