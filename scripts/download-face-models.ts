/**
 * Script to download face-api.js model weights
 * Run with: npx tsx scripts/download-face-models.ts
 */

import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

const MODEL_BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'models');

const MODELS = [
  // TinyFaceDetector
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',

  // FaceLandmark68Tiny
  'face_landmark_68_tiny_model-weights_manifest.json',
  'face_landmark_68_tiny_model-shard1',

  // FaceRecognition
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',

  // SsdMobilenetv1 (optional, as fallback)
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
];

async function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);

    console.log(`Downloading: ${url}`);
    console.log(`  -> ${outputPath}`);

    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          file.close();
          downloadFile(redirectUrl, outputPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`  ✓ Done`);
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      reject(err);
    });
  });
}

async function main() {
  console.log('\n📦 Face-API.js Model Downloader\n');
  console.log(`Output directory: ${OUTPUT_DIR}\n`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('Created directory:', OUTPUT_DIR);
  }

  let successCount = 0;
  let failCount = 0;

  for (const model of MODELS) {
    const url = `${MODEL_BASE_URL}/${model}`;
    const outputPath = path.join(OUTPUT_DIR, model);

    try {
      await downloadFile(url, outputPath);
      successCount++;
    } catch (error: any) {
      console.log(`  ✗ Failed: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\n📊 Download Complete`);
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  ✗ Failed: ${failCount}`);

  if (failCount > 0) {
    console.log('\n⚠️  Some models failed to download.');
    console.log('    You may need to download them manually from:');
    console.log('    https://github.com/justadudewhohacks/face-api.js/tree/master/weights\n');
  } else {
    console.log('\n✅ All models downloaded successfully!');
    console.log('   You can now use the face recognition features.\n');
  }
}

main().catch(console.error);
