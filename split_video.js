const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const inputDir = path.join(__dirname, 'raw-videos');
const outputDir = path.join(__dirname, 'result');
const tempDir = path.join(__dirname, 'temp');
const segmentDuration = 30; // Seconds
const inputVideo = 'input.mp4'; // Name of the video file in raw-videos

// Video title: Change this variable or pass via command line
let videoTitle = 'Autonomous Weapons'; // Default title
if (process.argv[2]) {
  videoTitle = process.argv[2]; // Override with command-line argument
}

// Bottom text for YouTube promotion
const bottomText = 'View full single video on YouTube channel, link in bio';
// For multi-line bottom text (uncomment to use)
// const bottomTextLine1 = 'View full single video';
// const bottomTextLine2 = 'on YouTube channel, link in bio';

// Optional: Set FFmpeg and ffprobe paths explicitly (uncomment and adjust as needed)
// ffmpeg.setFfmpegPath('C:/ffmpeg/bin/ffmpeg.exe'); // Windows example
// ffmpeg.setFfprobePath('C:/ffmpeg/bin/ffprobe.exe'); // Windows example

// Ensure directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error('Error creating directories:', error.message);
    process.exit(1);
  }
}

// Get video duration and resolution using ffprobe
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

// Create a preview segment with multiple text position options
async function createPreviewSegment(inputPath, title, outputPath, videoWidth, videoHeight) {
  return new Promise((resolve, reject) => {
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedBottomText = bottomText.replace(/'/g, "\\'");
    // For multi-line bottom text (uncomment to use)
    // const escapedBottomTextLine1 = bottomTextLine1.replace(/'/g, "\\'");
    // const escapedBottomTextLine2 = bottomTextLine2.replace(/'/g, "\\'");
    const topTextFontSize = 40;
    const bottomTextFontSize = 30;

    // Define multiple positions to test
    const textPositions = [
      {
        name: 'User-Specified (Title above Bottom Text)',
        top: `drawtext=text='${escapedTitle} - Part 1':fontcolor=white:fontsize=${topTextFontSize}:x=52:y=488`,
        bottom: `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=528`
        // For multi-line (uncomment to use)
        // bottom: [
        //   `drawtext=text='${escapedBottomTextLine1}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=528`,
        //   `drawtext=text='${escapedBottomTextLine2}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=568`
        // ]
      },
      {
        name: 'Centered (Title above Bottom Text)',
        top: `drawtext=text='${escapedTitle} - Part 1':fontcolor=white:fontsize=${topTextFontSize}:x=(w-text_w)/2:y=${videoHeight - 140}`,
        bottom: `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=(w-text_w)/2:y=${videoHeight - 100}`
      },
      {
        name: 'Bottom Left (Title above Bottom Text)',
        top: `drawtext=text='${escapedTitle} - Part 1':fontcolor=white:fontsize=${topTextFontSize}:x=20:y=${videoHeight - 140}`,
        bottom: `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=20:y=${videoHeight - 100}`
      }
    ];

    // Combine filters to show all positions sequentially
    const filters = textPositions.flatMap((pos, index) => {
      const startTime = index * 5;
      const endTime = (index + 1) * 5;
      const bottomFilters = Array.isArray(pos.bottom)
        ? pos.bottom.map((b, i) => ({
            filter: 'drawtext',
            options: {
              text: i === 0 ? escapedBottomTextLine1 : escapedBottomTextLine2,
              fontcolor: 'white',
              fontsize: bottomTextFontSize,
              x: b.split(':x=')[1].split(':')[0],
              y: b.split(':y=')[1].split(':')[0],
              enable: `between(t,${startTime},${endTime})`
            }
          }))
        : [{
            filter: 'drawtext',
            options: {
              text: escapedBottomText,
              fontcolor: 'white',
              fontsize: bottomTextFontSize,
              x: pos.bottom.split(':x=')[1].split(':')[0],
              y: pos.bottom.split(':y=')[1].split(':')[0],
              enable: `between(t,${startTime},${endTime})`
            }
          }];
      return [
        {
          filter: 'drawtext',
          options: {
            text: `${escapedTitle} - Part 1`,
            fontcolor: 'white',
            fontsize: topTextFontSize,
            x: pos.top.split(':x=')[1].split(':')[0],
            y: pos.top.split(':y=')[1].split(':')[0],
            enable: `between(t,${startTime},${endTime})`
          }
        },
        ...bottomFilters
      ];
    });

    ffmpeg(inputPath)
      .setStartTime(0)
      .duration(15) // 15-second preview (5 seconds per position)
      .videoFilters(filters)
      .outputOptions(['-c:v libx264', '-c:a aac', '-y'])
      .output(outputPath)
      .on('end', () => {
        console.log(`Preview created: ${outputPath}`);
        console.log('Positions tested: User-Specified (0-5s), Centered (5-10s), Bottom Left (10-15s)');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error creating preview:', err.message);
        reject(err);
      })
      .run();
  });
}

// Split video into segments
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

// Add text overlays using FFmpeg drawtext (final position)
async function addTextOverlay(inputSegment, title, partNumber, outputPath, videoHeight) {
  return new Promise((resolve, reject) => {
    const escapedTitle = title.replace(/'/g, "\\'");
    const escapedBottomText = bottomText.replace(/'/g, "\\'");
    const topTextFontSize = 40;
    const bottomTextFontSize = 30;

    // Place title just above bottom text (x=52, y=488)
    ffmpeg(inputSegment)
      .videoFilters([
        `drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=white:fontsize=${topTextFontSize}:x=52:y=488`,
        `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=528`
        // For multi-line bottom text (uncomment to use)
        // `drawtext=text='${escapedBottomTextLine1}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=528`,
        // `drawtext=text='${escapedBottomTextLine2}':fontcolor=white:fontsize=${bottomTextFontSize}:x=52:y=568`
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

// Main function
async function main() {
  try {
    console.log(`Starting video processing with title: "${videoTitle}"`);
    await ensureDirectories();
    const inputPath = path.join(inputDir, inputVideo);

    // Check if input video exists
    try {
      await fs.access(inputPath);
    } catch {
      console.error(`Input video ${inputPath} not found. Please place "${inputVideo}" in the raw-videos folder.`);
      process.exit(1);
    }

    // Get video metadata (duration and resolution)
    console.log('Retrieving video metadata...');
    let metadata;
    try {
      metadata = await getVideoMetadata(inputPath);
      console.log(`Video duration: ${metadata.duration} seconds, Resolution: ${metadata.width}x${metadata.height}`);
      if (metadata.width / metadata.height > 1) {
        console.warn('Warning: Video aspect ratio is not 9:16. Expected width < height.');
      }
      if (metadata.height < 528 + 50) {
        console.warn('Warning: Specified y=528 for bottom text may be too low for video height. Consider y=(h-100).');
      }
    } catch (error) {
      console.error('Failed to retrieve video metadata:', error.message);
      process.exit(1);
    }

    // Create preview segment to test text positions
    console.log('Creating preview segment to test text positions...');
    const previewPath = path.join(outputDir, 'preview.mp4');
    try {
      await createPreviewSegment(inputPath, videoTitle, previewPath, metadata.width, metadata.height);
      console.log('Please review the preview video to confirm text positions.');
      console.log('Then, update the addTextOverlay function if needed.');
    } catch (error) {
      console.error('Failed to create preview:', error.message);
      // Continue to process segments even if preview fails
    }

    // Split video into segments
    console.log('Splitting video into segments...');
    let segments;
    try {
      segments = await splitVideo(inputPath, metadata.duration);
    } catch (error) {
      console.error('Failed to split video:', error.message);
      process.exit(1);
    }

    // Add text overlays to each segment
    console.log('Adding text overlays to segments...');
    for (let i = 0; i < segments.length; i++) {
      const outputPath = path.join(outputDir, `video_part_${i + 1}.mp4`);
      try {
        await addTextOverlay(segments[i], videoTitle, i + 1, outputPath, metadata.height);
      } catch (error) {
        console.error(`Failed to process part ${i + 1}:`, error.message);
      }
    }

    // Clean up temp files
    console.log('Cleaning up temporary files...');
    await fs.rm(tempDir, { recursive: true, force: true });
    console.log('Processing complete! Check the result folder for output videos.');
  } catch (error) {
    console.error('Unexpected error:', error.message);
    process.exit(1);
  }
}

main();