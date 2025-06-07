Video Splitter with Text Overlays
This Node.js script processes a 9:16 video (e.g., 1080x1920) by splitting it into 30-second segments and adding two text overlays:

Title: A customizable title (e.g., "My Awesome Video - Part X") at x=52, y=488.
Promotional Text: "View full single video on YouTube channel, link in bio" at x=52, y=528.The script uses FFmpeg via the fluent-ffmpeg library and generates a preview to test text positions.

Prerequisites

Node.js: Version 14 or higher. Install from nodejs.org.
FFmpeg: Required for video processing. Install FFmpeg and ensure ffmpeg and ffprobe are in your system PATH.
Windows:
Download from ffmpeg.org or use Chocolatey:choco install ffmpeg


Add FFmpeg to PATH (e.g., C:\ffmpeg\bin).


macOS:brew install ffmpeg


Linux (Ubuntu/Debian):sudo apt-get update
sudo apt-get install ffmpeg


Verify installation:ffmpeg -version
ffprobe -version




Input Video: A 9:16 video (e.g., 1080x1920, MP4 with H.264/AAC) named input.mp4.

Setup

## Clone or Download:

## Install Dependencies:
```
npm i
```

## Navigate to the project folder
```
Prepare Folders:

Create a raw-videos folder in the project directory.
Place your 9:16 video as raw-videos/input.mp4.
The script will create result (for output videos) and temp (for temporary files) folders automatically.
```


## Usage
```
Run the Script:

node split_video.js
```

Outputs:

Preview: result/preview.mp4 (15 seconds) tests text positions:
0-5s: Title at x=52, y=488, bottom text at x=52, y=528.
5-10s: Title and bottom text centered near bottom.
10-15s: Title and bottom text at bottom left.


Segments: result/video_part_1.mp4, result/video_part_2.mp4, etc. (30-second clips with text overlays).
Console Logs: Show progress, video resolution, and warnings (e.g., if the aspect ratio isn’t 9:16).


Review the Preview:

Open result/preview.mp4 on a device (e.g., phone) to check text placement.
If the title isn’t close enough to the bottom text, adjust the y coordinate in the addTextOverlay function (e.g., change y=488 to y=478).



Customization
Change the Video Title

In Script: Edit split-video-ffmpeg-drawtext.js:let videoTitle = 'Your Custom Title';


Command Line: Pass when running:node split-video-ffmpeg-drawtext.js "Your Custom Title"



Adjust Text Position

Default: Title at x=52, y=488, bottom text at x=52, y=528 (user-specified).
Modify: In addTextOverlay, update coordinates:
```
.videoFilters([
  `drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=white:fontsize=40:x=52:y=478`, // Closer to bottom text
  `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=30:x=52:y=528`
])
```
```
Centered:.videoFilters([
  `drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=white:fontsize=40:x=(w-text_w)/2:y=488`,
  `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=30:x=(w-text_w)/2:y=528`
])
```
```
Bottom Placement:.videoFilters([
  `drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=white:fontsize=40:x=52:y=${videoHeight - 140}`,
  `drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=30:x=52:y=${videoHeight - 100}`
])
```


Multi-Line Bottom Text

Uncomment in the script:const bottomTextLine1 = 'View full single video';
```
const bottomTextLine2 = 'on YouTube channel, link in bio';

.videoFilters([
  `drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=white:fontsize=40:x=52:y=488`,
  `drawtext=text='${escapedBottomTextLine1}':fontcolor=white:fontsize=30:x=52:y=528`,
  `drawtext=text='${escapedBottomTextLine2}':fontcolor=white:fontsize=30:x=52:y=568`
])
```

Adjust y=568 for line spacing (e.g., y=548 for a tighter gap).

Text Styling
```
Font Size:const topTextFontSize = 36; // Smaller title
const bottomTextFontSize = 28; // Smaller bottom text


Color:`drawtext=text='${escapedTitle} - Part ${partNumber}':fontcolor=yellow:fontsize=40:x=52:y=488`


Shadow:`drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=30:x=52:y=528:shadowcolor=black:shadowx=2:shadowy=2`


Custom Font:`drawtext=text='${escapedBottomText}':fontcolor=white:fontsize=30:x=52:y=528:fontfile=/path/to/font.ttf`
```
Example font paths:
```
Windows: C:/Windows/Fonts/arial.ttf
Linux: /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf
macOS: /System/Library/Fonts/Helvetica.ttf
```


Change Segment Duration
```
Edit segmentDuration:const segmentDuration = 60; // 1-minute segments
```


Troubleshooting

FFmpeg/ffprobe Not Found:
```
Verify installation: ffmpeg -version, ffprobe -version.
Set explicit paths in the script:ffmpeg.setFfmpegPath('/path/to/ffmpeg');
ffmpeg.setFfprobePath('/path/to/ffprobe');
```



Text Overlap or Cut Off:
```
Adjust y=488 (title) to y=478 or y=468 if overlapping with y=528.
Reduce bottomTextFontSize to 28 if text exceeds 1080px width.
Enable multi-line bottom text for long text.
```

Font Issues:
```
Specify a fontfile or install fonts:sudo apt-get install fonts-dejavu # Ubuntu
```



Input Video:
```
Ensure input.mp4 is in raw-videos, 9:16 (e.g., 1080x1920), and MP4 with H.264/AAC.
Check console for aspect ratio warnings.
```

Position Issues:
```
If y=528 is too high (27.5% from top in 1920px height), use y=${videoHeight - 100} (e.g., y=1820) for bottom placement.
Review result/preview.mp4 to test alternative positions.
```


Example Output
```
For a 12-minute video (raw-videos/input.mp4, 1080x1920) with videoTitle = 'My Awesome Video':

Preview: result/preview.mp4 (15s):
0-5s: Title at x=52, y=488, bottom text at x=52, y=528.
5-10s: Title and bottom text centered near bottom.
10-15s: Title and bottom text at bottom left.


Segments:
result/video_part_1.mp4: Title "My Awesome Video - Part 1" at x=52, y=488, bottom text at x=52, y=528.
result/video_part_2.mp4, ..., result/video_part_24.mp4.


```
Notes

The default title position (y=488) is 40px above the bottom text (y=528) to avoid overlap. Adjust if needed.
For social media (e.g., TikTok, Instagram), ensure text stays within safe zones (5-10% margin from edges).
To process multiple videos, modify the script to loop through 
```
raw-videos:const files = await fs.readdir(inputDir);
for (const file of files.filter(f => f.endsWith('.mp4'))) {
  const inputPath = path.join(inputDir, file);
  videoTitle = process.argv[2] || path.basename(file, '.mp4');
  // Process each video
}
```

