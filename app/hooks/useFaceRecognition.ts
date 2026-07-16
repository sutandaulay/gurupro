'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';

// Model paths - hosted on your server or CDN
const MODEL_URL = '/models';

// Model configurations
const MODEL_CONFIGS = {
  withTinyFaceDetector: true, // Use tiny model for faster loading
  inputSize: 512, // Increased input size to better match expected tensor dimensions
  scoreThreshold: 0.5, // Minimum confidence score
};

export interface FaceDetectionResult {
  detected: boolean;
  box?: faceapi.Box;
  landmarks?: faceapi.FaceLandmarks68;
  descriptor?: Float32Array;
  confidence: number;
  alignedRect?: faceapi.FaceDetection;
}

export interface LivenessResult {
  passed: boolean;
  checks: {
    faceDetected: boolean;
    faceNotTooSmall: boolean;
    faceNotOffCenter: boolean;
    sufficientLighting: boolean;
    noMultipleFaces: boolean;
  };
  score: number;
}

export interface FaceMatchResult {
  match: boolean;
  distance: number;
  similarity: number;
  threshold: number;
}

export interface FaceRecognitionState {
  isLoading: boolean;
  isModelLoaded: boolean;
  error: string | null;
  modelsLoadProgress: number;
}

export function useFaceRecognition() {
  const [state, setState] = useState<FaceRecognitionState>({
    isLoading: false,
    isModelLoaded: false,
    error: null,
    modelsLoadProgress: 0,
  });

  const isInitializedRef = useRef(false);

  // Initialize/load face-api models
  const loadModels = useCallback(async () => {
    if (isInitializedRef.current || state.isModelLoaded) {
      return true;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      console.log('Loading face-api models from:', MODEL_URL);

      // Load all required models
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Fallback detector
      ]);

      isInitializedRef.current = true;
      setState(prev => ({
        ...prev,
        isLoading: false,
        isModelLoaded: true,
        modelsLoadProgress: 100,
      }));

      console.log('Face-api models loaded successfully');
      return true;
    } catch (error: any) {
      console.error('Failed to load face-api models:', error);
      const errorMessage = error.message || 'Gagal memuat model pengenalan wajah';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return false;
    }
  }, [state.isModelLoaded]);

  // Detect face in an image/video element
  const detectFace = useCallback(async (
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageData
  ): Promise<FaceDetectionResult> => {
    if (!state.isModelLoaded) {
      const loaded = await loadModels();
      if (!loaded) {
        return { detected: false, confidence: 0 };
      }
    }

    try {
      // Validate input dimensions before processing
      let inputWidth: number, inputHeight: number;
      
      if (input instanceof HTMLVideoElement) {
        inputWidth = input.videoWidth;
        inputHeight = input.videoHeight;
      } else if (input instanceof HTMLCanvasElement || input instanceof HTMLImageElement) {
        inputWidth = input.width;
        inputHeight = input.height;
      } else if (input instanceof ImageData) {
        inputWidth = input.width;
        inputHeight = input.height;
      } else {
        console.error('Unsupported input type for face detection');
        return { detected: false, confidence: 0 };
      }

      // Ensure minimum dimensions for face detection based on model input size
      const minDimension = MODEL_CONFIGS.inputSize / 4; // At least 1/4 of input size
      if (inputWidth < minDimension || inputHeight < minDimension) {
        console.warn(`Input dimensions (${inputWidth}x${inputHeight}) are too small for face detection with inputSize ${MODEL_CONFIGS.inputSize}`);
        return { detected: false, confidence: 0 };
      }

      // Create a canvas with exact model input size to ensure consistent tensor dimensions
      const canvas = document.createElement('canvas');
      canvas.width = MODEL_CONFIGS.inputSize;
      canvas.height = MODEL_CONFIGS.inputSize;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw input onto the model-sized canvas, maintaining aspect ratio with padding
        ctx.fillStyle = 'black'; // Fill with black for areas outside the image
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratios
        const inputAspect = inputWidth / inputHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (inputAspect > canvasAspect) {
          // Input is wider than canvas (landscape)
          drawWidth = canvas.width;
          drawHeight = canvas.width / inputAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // Input is taller than canvas (portrait)
          drawHeight = canvas.height;
          drawWidth = canvas.height * inputAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }
        
        // Draw the image maintaining aspect ratio
        ctx.drawImage(input as any, offsetX, offsetY, drawWidth, drawHeight);
      }

      // Detect face with TinyFaceDetector first (faster)
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: MODEL_CONFIGS.inputSize,
        scoreThreshold: MODEL_CONFIGS.scoreThreshold,
      });

      const detections = await faceapi
        .detectAllFaces(canvas, options)
        .withFaceLandmarks(MODEL_CONFIGS.withTinyFaceDetector)
        .withFaceDescriptors();

      if (detections.length === 0) {
        return { detected: false, confidence: 0 };
      }

      if (detections.length > 1) {
        return {
          detected: false,
          confidence: 0,
          box: detections[0].detection.box,
        };
      }

      const detection = detections[0];

      return {
        detected: true,
        box: detection.detection.box,
        landmarks: detection.landmarks,
        descriptor: detection.descriptor,
        confidence: detection.detection.score,
        alignedRect: detection.detection,
      };
    } catch (error: any) {
      console.error('Face detection error:', error);
      // Check specifically for tensor-related errors
      if (error.message && (error.message.includes('tensor') || error.message.includes('dimensions'))) {
        console.error('Tensor dimension mismatch error during face detection');
        return { detected: false, confidence: 0 };
      }
      return { detected: false, confidence: 0 };
    }
  }, [state.isModelLoaded, loadModels]);

  // Check liveness - simplified version
  const checkLiveness = useCallback(async (
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<LivenessResult> => {
    const checks = {
      faceDetected: false,
      faceNotTooSmall: false,
      faceNotOffCenter: false,
      sufficientLighting: false,
      noMultipleFaces: false,
    };

    let score = 0;

    try {
      // Validate input dimensions before processing
      let inputWidth: number, inputHeight: number;
      
      if (input instanceof HTMLVideoElement) {
        inputWidth = input.videoWidth;
        inputHeight = input.videoHeight;
      } else if (input instanceof HTMLCanvasElement || input instanceof HTMLImageElement) {
        inputWidth = input.width;
        inputHeight = input.height;
      } else {
        console.error('Unsupported input type for liveness check');
        return { passed: false, checks, score };
      }

      // Ensure minimum dimensions for face detection based on model input size
      const minDimension = MODEL_CONFIGS.inputSize / 4; // At least 1/4 of input size
      if (inputWidth < minDimension || inputHeight < minDimension) {
        console.warn(`Input dimensions (${inputWidth}x${inputHeight}) are too small for liveness check with inputSize ${MODEL_CONFIGS.inputSize}`);
        return { passed: false, checks, score };
      }

      // Create a canvas with exact model input size to ensure consistent tensor dimensions
      const canvas = document.createElement('canvas');
      canvas.width = MODEL_CONFIGS.inputSize;
      canvas.height = MODEL_CONFIGS.inputSize;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw input onto the model-sized canvas, maintaining aspect ratio with padding
        ctx.fillStyle = 'black'; // Fill with black for areas outside the image
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratios
        const inputAspect = inputWidth / inputHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (inputAspect > canvasAspect) {
          // Input is wider than canvas (landscape)
          drawWidth = canvas.width;
          drawHeight = canvas.width / inputAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // Input is taller than canvas (portrait)
          drawHeight = canvas.height;
          drawWidth = canvas.height * inputAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }
        
        // Draw the image maintaining aspect ratio
        ctx.drawImage(input as any, offsetX, offsetY, drawWidth, drawHeight);
      }

      // Detect face first
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: MODEL_CONFIGS.inputSize,
        scoreThreshold: MODEL_CONFIGS.scoreThreshold,
      });

      const detections = await faceapi
        .detectAllFaces(canvas, options)
        .withFaceLandmarks(MODEL_CONFIGS.withTinyFaceDetector);

      // Check 1: Face detected
      if (detections.length === 1) {
        checks.faceDetected = true;
        checks.noMultipleFaces = true;
        score += 20;
      } else if (detections.length > 1) {
        checks.noMultipleFaces = false;
        return { passed: false, checks, score };
      }

      if (detections.length === 0) {
        return { passed: false, checks, score };
      }

      const detection = detections[0];
      const box = detection.detection.box;
      const confidence = detection.detection.score;

      // Check 2: Face size (not too small)
      const minFaceSize = 80;
      if (box.width >= minFaceSize && box.height >= minFaceSize) {
        checks.faceNotTooSmall = true;
        score += 20;
      }

      // Check 3: Face centered
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const canvasCenterX = canvas.width / 2;
      const canvasCenterY = canvas.height / 2;

      const offsetX = Math.abs(centerX - canvasCenterX) / canvas.width;
      const offsetY = Math.abs(centerY - canvasCenterY) / canvas.height;

      if (offsetX < 0.25 && offsetY < 0.3) {
        checks.faceNotOffCenter = true;
        score += 20;
      }

      // Check 4: Sufficient lighting (based on image variance)
      const lightingCtx = canvas.getContext('2d');
      if (lightingCtx) {
        const imageData = lightingCtx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Calculate luminance variance
        let sumL = 0;
        const pixels: number[] = [];

        for (let i = 0; i < data.length; i += 40) { // Sample every 10 pixels
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          pixels.push(luminance);
          sumL += luminance;
        }

        const mean = sumL / pixels.length;
        let variance = 0;
        for (const p of pixels) {
          variance += Math.pow(p - mean, 2);
        }
        variance /= pixels.length;

        // Good variance indicates sufficient lighting
        if (variance > 400) {
          checks.sufficientLighting = true;
          score += 20;
        }
      }

      // Check 5: High confidence detection
      if (confidence > 0.8) {
        score += 20;
      }

      const passed = score >= 60;

      return { passed, checks, score };
    } catch (error: any) {
      console.error('Liveness check error:', error);
      // Check specifically for tensor-related errors
      if (error.message && (error.message.includes('tensor') || error.message.includes('dimensions'))) {
        console.error('Tensor dimension mismatch error during liveness check');
      }
      return { passed: false, checks, score };
    }
  }, []);

  // Match two face descriptors
  const matchFaces = useCallback((
    descriptor1: Float32Array,
    descriptor2: Float32Array,
    threshold: number = 0.6
  ): FaceMatchResult => {
    const distance = faceapi.euclideanDistance(descriptor1, descriptor2);
    const similarity = 1 - distance;

    return {
      match: distance < threshold,
      distance,
      similarity,
      threshold,
    };
  }, []);

  // Create face descriptor from stored images
  const createFaceDescriptor = useCallback(async (
    imageUrl: string
  ): Promise<Float32Array | null> => {
    if (!state.isModelLoaded) {
      const loaded = await loadModels();
      if (!loaded) return null;
    }

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
      });

      // Ensure minimum dimensions for face detection based on model input size
      const minDimension = MODEL_CONFIGS.inputSize / 4; // At least 1/4 of input size
      if (img.width < minDimension || img.height < minDimension) {
        console.warn(`Image dimensions (${img.width}x${img.height}) are too small for face detection with inputSize ${MODEL_CONFIGS.inputSize}`);
        return null;
      }

      // Create a canvas with exact model input size to ensure consistent tensor dimensions
      const canvas = document.createElement('canvas');
      canvas.width = MODEL_CONFIGS.inputSize;
      canvas.height = MODEL_CONFIGS.inputSize;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Draw input onto the model-sized canvas, maintaining aspect ratio with padding
        ctx.fillStyle = 'black'; // Fill with black for areas outside the image
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate aspect ratios
        const inputAspect = img.width / img.height;
        const canvasAspect = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (inputAspect > canvasAspect) {
          // Input is wider than canvas (landscape)
          drawWidth = canvas.width;
          drawHeight = canvas.width / inputAspect;
          offsetX = 0;
          offsetY = (canvas.height - drawHeight) / 2;
        } else {
          // Input is taller than canvas (portrait)
          drawHeight = canvas.height;
          drawWidth = canvas.height * inputAspect;
          offsetX = (canvas.width - drawWidth) / 2;
          offsetY = 0;
        }
        
        // Draw the image maintaining aspect ratio
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: MODEL_CONFIGS.inputSize,
        scoreThreshold: MODEL_CONFIGS.scoreThreshold,
      });

      const detections = await faceapi
        .detectAllFaces(canvas, options)
        .withFaceLandmarks(MODEL_CONFIGS.withTinyFaceDetector)
        .withFaceDescriptors();

      if (detections.length === 0) {
        console.warn(`No face detected in image: ${imageUrl}`);
        return null;
      }

      return detections[0].descriptor;
    } catch (error: any) {
      console.error('Error creating face descriptor:', error);
      // Check specifically for tensor-related errors
      if (error.message && (error.message.includes('tensor') || error.message.includes('dimensions'))) {
        console.error('Tensor dimension mismatch error during face descriptor creation');
        return null;
      }
      return null;
    }
  }, [state.isModelLoaded, loadModels]);

  // Verify live face against stored descriptors
  const verifyFace = useCallback(async (
    videoElement: HTMLVideoElement,
    storedDescriptors: Float32Array[],
    threshold: number = 0.55
  ): Promise<FaceMatchResult> => {
    const liveResult = await detectFace(videoElement);

    if (!liveResult.detected || !liveResult.descriptor) {
      return {
        match: false,
        distance: 1,
        similarity: 0,
        threshold,
      };
    }

    let bestMatch: FaceMatchResult = {
      match: false,
      distance: 1,
      similarity: 0,
      threshold,
    };

    for (const storedDescriptor of storedDescriptors) {
      const result = matchFaces(liveResult.descriptor, storedDescriptor, threshold);

      if (result.similarity > bestMatch.similarity) {
        bestMatch = result;
      }

      if (result.match) {
        break; // Early exit if we found a match
      }
    }

    return bestMatch;
  }, [detectFace, matchFaces]);

  // Models are NOT auto-loaded on mount — caller must invoke loadModels() explicitly
  // to prevent premature fetch before the page is fully hydrated.

  return {
    ...state,
    loadModels,
    detectFace,
    checkLiveness,
    matchFaces,
    createFaceDescriptor,
    verifyFace,
  };
}

// Helper function to download models
export async function downloadModels(): Promise<boolean> {
  const baseUrl = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
  const modelsDir = '/models';

  const models = [
    { name: 'tiny_face_detector_model-weights_manifest.json', url: `${baseUrl}/tiny_face_detector_model-weights_manifest.json` },
    { name: 'tiny_face_detector_model-shard1', url: `${baseUrl}/tiny_face_detector_model-shard1` },
    { name: 'face_landmark_68_tiny_model-weights_manifest.json', url: `${baseUrl}/face_landmark_68_tiny_model-weights_manifest.json` },
    { name: 'face_landmark_68_tiny_model-shard1', url: `${baseUrl}/face_landmark_68_tiny_model-shard1` },
    { name: 'face_recognition_model-weights_manifest.json', url: `${baseUrl}/face_recognition_model-weights_manifest.json` },
    { name: 'face_recognition_model-shard1', url: `${baseUrl}/face_recognition_model-shard1` },
  ];

  console.log('Models to download:', models.map(m => m.name));
  console.log('Please copy these files to your public/models folder');

  return true;
}