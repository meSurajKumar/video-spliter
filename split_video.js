const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const inputDir = path.join(__dirname, 'raw-videos');
const outputDir = path.join(__dirname, 'result');
const tempDir = path.join(__dirname, 'temp');
const thumbnailDir = path.join(__dirname, 'thumbnails');
const descriptionDir = path.join(__dirname, 'descriptions');
const segmentDuration = 160; // Seconds 3 minutes
const inputVideo = 'input.mp4'; // Input video
const thumbnailImage = 'thumbnail.jpg'; // Common thumbnail

// Video title: Change or pass via command line
let videoTitle = 'Genetic Superhumans'; // Default
if (process.argv[2]) {
  videoTitle = process.argv[2];
}
// Caption template for Instagram Reels
const descriptionTemplate = `${videoTitle} -{X} #short #reels #superhuman #superman #geneediting`;

// Bottom text for video overlay
const bottomText = 'View full single video on YouTube channel, link in bio';

// Ensure directories
async function ensureDirectories() {
  try {
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(thumbnailDir, { recursive: true });
    await fs.mkdir(descriptionDir, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error.message);
    process.exit(1);
  }
}

// Get video metadata
async function getVideoMetadata(inputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) {
        console.error('ffprobe error:', err.message);
        return reject(new Error(`ffprobe failed: ${err.message}`));
      }
      const duration = metadata.format.duration;
      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      const { width, height } = videoStream;
      resolve({ duration, width, height });
    });
  });
}

// Generate caption
async function generateDescription(partNumber, outputPath) {
  const description = descriptionTemplate.replace('{X}', partNumber);
  try {
    await fs.writeFile(outputPath, description);
    console.log(`Caption created: ${outputPath}`);
  } catch (error) {
    console.error(`Error creating caption for part ${partNumber}:`, error.message);
  }
}

// Generate thumbnail
async function generateThumbnail(partNumber, outputPath) {
  const thumbnailInput = path.join(thumbnailDir, thumbnailImage);
  const thumbnailText = `${videoTitle} PART -${partNumber}`;
  return new Promise((resolve, reject) => {
    try {
      fs.access(thumbnailInput).catch(() => {
        throw new Error(`Thumbnail image ${thumbnailInput} not found.`);
      });

      ffmpeg(thumbnailInput)
        .videoFilters([
          `drawtext=text='${thumbnailText.replace(/'/g, "\\'")}':fontcolor=white:fontsize=60:x=108:y=192:shadowcolor=black:shadowx=2:shadowy=2`
        ])
        .outputOptions(['-vframes 1', '-y'])
        .output(outputPath)
        .on('end', () => {
          console.log(`Thumbnail created for part ${partNumber}: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error(`Error creating thumbnail for part ${partNumber}:`, err.message);
          reject(err);
        })
        .run();
    } catch (error) {
      console.error(`Thumbnail generation error: ${error.message}`);
      reject(error);
    }
  });
}

// Create preview
async function createPreviewSegment(inputPath, title, outputPath, videoWidth, videoHeight) {
  return new Promise((resolve, reject) => {
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedBottomText = bottomText.replace(/'/g, "\\'");
    const topTextFontSize = 40;
    const bottomTextFontSize = 30;

    const textPositions = [
      {
        name: 'User-Specified',
        top: `drawtext=text='${escapedTitle} - Part 1':fontcolor=white:fontsize=${topTextFontSize}:x=52:y=488`,
        bottom: `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=528`
      },
      {
        name: 'Centered',
        top: `drawtext=text='${escapedTitle} - Part 1':fontcolor=white:fontsize=${topTextFontSize}:x=(w-text_w)/2:y=${videoHeight - 232}`,
        bottom: `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=(w-text_w)/2:y=${videoHeight - 192}`
      },
      {
        name: 'Bottom Left',
        top: `drawtext=text='${escapedTitle} - Part 1':fontcolor=white:fontsize=${topTextFontSize}:x=108:y=${videoHeight - 232}`,
        bottom: `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=108:y=${videoHeight - 192}`
      }
    ];

    const filters = textPositions.flatMap((pos, index) => [
      {
        filter: 'drawtext',
        options: {
          text: `${escapedTitle} - Part 1`,
          fontcolor: 'white',
          fontsize: topTextFontSize,
          x: pos.top.split(':x=')[1].split(':')[0],
          y: pos.top.split(':y=')[1].split(':')[0],
          enable: `between(t,${index * 5},${(index + 1) * 5})`
        }
      },
      {
        filter: 'drawtext',
        options: {
          text: escapedBottomText,
          fontcolor: 'white',
          fontsize: bottomTextFontSize,
          x: pos.bottom.split(':x=')[1].split(':')[0],
          y: pos.bottom.split(':y=')[1].split(':')[0],
          enable: `between(t,${index * 5},${(index + 1) * 5})`
        }
      }
    ]);

    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(15)
      .videoFilters(filters)
      .outputOptions(['-c:v libx264', '-c:a aac', '-y'])
      .output(outputPath)
      .on('end', () => {
        console.log(`Preview created: ${outputPath}`);
        console.log('Positions: User-Specified (0-5s), Centered (5-10s), Bottom Left (10-15s)');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error creating preview:', err.message);
        reject(err);
      })
      .run();
  });
}

// Split video
async function splitVideo(inputPath, duration) {
  const numSegments = Math.ceil(duration / segmentDuration);
  const promises = [];

  for (let i = 0; i < numSegments; i++) {
    const startTime = i * segmentDuration;
    const outputFile = path.join(tempDir, `segment_${i + 1}.mp4`);

    promises.push(
      new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .setStartTime(startTime)
          .duration(segmentDuration)
          .outputOptions(['-c:v libx264', '-c:a aac', '-y'])
          .output(outputFile)
          .on('end', () => {
            console.log(`Segment ${i + 1} created: ${outputFile}`);
            resolve(outputFile);
          })
          .on('error', (err) => {
            console.error(`Error creating segment ${i + 1}:`, err.message);
            reject(err);
          })
          .run();
      })
    );
  }

  return Promise.all(promises);
}

// Add text overlays
async function addTextOverlay(inputSegment, title, partNumber, outputPath, videoHeight) {
  return new Promise((resolve, reject) => {
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedBottomText = bottomText.replace(/'/g, "\\'");
    const topTextFontSize = 40;
    const bottomTextFontSize = 30;

    ffmpeg(inputSegment)
      .videoFilters([
        `drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=white:fontsize=${topTextFontSize}:x=52:y=488`,
        `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=528`
      ])
      .outputOptions(['-c:v libx264', '-c:a aac', '-y'])
      .output(outputPath)
      .on('end', () => {
        console.log(`Text overlays added for part ${partNumber}: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error(`Error adding text overlays for part ${partNumber}:`, err.message);
        reject(err);
      })
      .run();
  });
}

// Main
async function main() {
  try {
    console.log(`Starting with title: "${videoTitle}"`);
    await ensureDirectories();
    const inputPath = path.join(inputDir, inputVideo);

    // Check input
    try {
      await fs.access(inputPath);
    } catch {
      console.error(`Input video ${inputPath} not found. Place "${inputVideo}" in raw-videos.`);
      process.exit(1);
    }

    // Check thumbnail
    const thumbnailPath = path.join(thumbnailDir, thumbnailImage);
    try {
      await fs.access(thumbnailPath);
    } catch {
      console.error(`Thumbnail ${thumbnailPath} not found. Place "${thumbnailImage}" in thumbnails.`);
      process.exit(1);
    }

    // Get metadata
    console.log('Retrieving metadata...');
    let metadata;
    try {
      metadata = await getVideoMetadata(inputPath);
      console.log(`Duration: ${metadata.duration}s, Resolution: ${metadata.width}x${metadata.height}`);
      if (metadata.width / metadata.height > 1) {
        console.warn('Warning: Not 9:16.');
      }
      if (metadata.height < 528 + 50) {
        console.warn('Warning: y=528 too low. Consider y=(h-192).');
      }
    } catch (error) {
      console.error('Metadata error:', error.message);
      process.exit(1);
    }

    // Create preview
    console.log('Creating preview...');
    const previewPath = path.join(outputDir, 'preview.mp4');
    try {
      await createPreviewSegment(inputPath, videoTitle, previewPath, metadata.width, metadata.height);
    } catch (error) {
      console.error('Preview error:', error.message);
    }

    // Split video
    console.log('Splitting video...');
    let segments;
    try {
      segments = await splitVideo(inputPath, metadata.duration);
    } catch (error) {
      console.error('Split error:', error.message);
      process.exit(1);
    }

    // Process segments
    console.log('Processing segments...');
    for (let i = 0; i < segments.length; i++) {
      const partNumber = i + 1;
      const outputVideoPath = path.join(outputDir, `video_part_${partNumber}.mp4`);
      const descriptionPath = path.join(descriptionDir, `description_part_${partNumber}.txt`);
      const thumbnailOutputPath = path.join(thumbnailDir, `thumbnail_part_${partNumber}.jpg`);

      try {
        await addTextOverlay(segments[i], videoTitle, partNumber, outputVideoPath, metadata.height);
        await generateDescription(partNumber, descriptionPath);
        await generateThumbnail(partNumber, thumbnailOutputPath);
      } catch (error) {
        console.error(`Part ${partNumber} error:`, error.message);
      }
    }

    // Clean up
    console.log('Cleaning up...');
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('Complete! Check result, descriptions, thumbnails.');
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

main();