import { useState } from 'react';
import * as React from 'react';
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { AlertTriangle, CheckCircle2, Shield } from "lucide-react";

interface WatermarkDetectorProps {
  image: HTMLImageElement | null;
  onDetectionComplete: (hasWatermark: boolean, confidence: number) => void;
  autoDetect?: boolean;
}

export function WatermarkDetector({ image, onDetectionComplete, autoDetect = false }: WatermarkDetectorProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionResult, setDetectionResult] = useState<{
    hasWatermark: boolean;
    confidence: number;
    reason: string;
  } | null>(null);

  const detectWatermark = () => {
    if (!image) return;

    setIsDetecting(true);

    setTimeout(() => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        setIsDetecting(false);
        return;
      }

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const hasWatermark = analyzeImage(data, canvas.width, canvas.height);
      
      setDetectionResult(hasWatermark);
      onDetectionComplete(hasWatermark.hasWatermark, hasWatermark.confidence);
      setIsDetecting(false);
    }, autoDetect ? 500 : 1500);
  };

  const analyzeImage = (data: Uint8ClampedArray, width: number, height: number) => {
    // Enhanced detection for tiled watermarks
    
    // 1. Check for repeating patterns across the image
    const patternScore = detectRepeatingPatterns(data, width, height);
    
    // 2. Check for semi-transparent overlays throughout the image
    const transparencyScore = detectSemiTransparentOverlay(data, width, height);
    
    // 3. Check for diagonal patterns (common in watermarks)
    const diagonalScore = detectDiagonalPatterns(data, width, height);
    
    // 4. Check for color consistency (watermarks often have uniform color)
    const colorConsistencyScore = detectColorConsistency(data, width, height);

    // Determine if watermark exists based on combined scores
    let hasWatermark = false;
    let confidence = 0;
    let reason = '';

    const totalScore = patternScore * 0.3 + transparencyScore * 0.3 + diagonalScore * 0.2 + colorConsistencyScore * 0.2;

    if (totalScore > 0.5) {
      hasWatermark = true;
      confidence = Math.min(95, Math.round(totalScore * 100));
      
      const reasons = [];
      if (patternScore > 0.5) reasons.push('repeating patterns');
      if (transparencyScore > 0.5) reasons.push('semi-transparent overlay');
      if (diagonalScore > 0.5) reasons.push('diagonal arrangements');
      if (colorConsistencyScore > 0.5) reasons.push('consistent coloring');
      
      reason = `Detected tiled watermark with ${reasons.join(', ')}`;
    } else {
      hasWatermark = false;
      confidence = Math.round((1 - totalScore) * 90);
      reason = 'No obvious watermark patterns detected';
    }

    return { hasWatermark, confidence, reason };
  };

  const detectRepeatingPatterns = (data: Uint8ClampedArray, width: number, height: number): number => {
    // Sample multiple regions and check for similarity
    const sampleSize = 50;
    const stride = Math.floor(Math.min(width, height) / 10);
    
    const samples: number[][] = [];
    
    // Collect samples from different regions
    for (let i = 0; i < 20; i++) {
      const x = Math.floor(Math.random() * (width - sampleSize));
      const y = Math.floor(Math.random() * (height - sampleSize));
      
      const sample: number[] = [];
      for (let dy = 0; dy < sampleSize && y + dy < height; dy += 5) {
        for (let dx = 0; dx < sampleSize && x + dx < width; dx += 5) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          sample.push(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
        }
      }
      samples.push(sample);
    }
    
    // Compare samples to find similarity
    let similarPairs = 0;
    let totalComparisons = 0;
    
    for (let i = 0; i < samples.length - 1; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        totalComparisons++;
        const similarity = calculateSimilarity(samples[i], samples[j]);
        if (similarity > 0.7) similarPairs++;
      }
    }
    
    return similarPairs / totalComparisons;
  };

  const detectSemiTransparentOverlay = (data: Uint8ClampedArray, width: number, height: number): number => {
    let semiTransparentPixels = 0;
    let totalPixels = 0;
    
    // Sample across the entire image
    for (let y = 0; y < height; y += 10) {
      for (let x = 0; x < width; x += 10) {
        const idx = (y * width + x) * 4;
        const alpha = data[idx + 3];
        
        // Check for semi-transparency
        if (alpha > 50 && alpha < 240) {
          semiTransparentPixels++;
        }
        totalPixels++;
      }
    }
    
    const ratio = semiTransparentPixels / totalPixels;
    // If more than 5% of sampled pixels are semi-transparent, likely has watermark
    return Math.min(1, ratio * 20);
  };

  const detectDiagonalPatterns = (data: Uint8ClampedArray, width: number, height: number): number => {
    // Check for patterns along diagonal lines
    let diagonalSimilarity = 0;
    let checks = 0;
    
    const step = 100; // Check every 100 pixels
    
    for (let i = 0; i < Math.min(width, height) - step * 2; i += step) {
      const idx1 = (i * width + i) * 4;
      const idx2 = ((i + step) * width + (i + step)) * 4;
      
      if (idx2 + 3 < data.length) {
        const similarity = Math.abs(data[idx1] - data[idx2]) + 
                          Math.abs(data[idx1 + 1] - data[idx2 + 1]) + 
                          Math.abs(data[idx1 + 2] - data[idx2 + 2]) + 
                          Math.abs(data[idx1 + 3] - data[idx2 + 3]);
        
        if (similarity < 100) diagonalSimilarity++;
        checks++;
      }
    }
    
    return checks > 0 ? diagonalSimilarity / checks : 0;
  };

  const detectColorConsistency = (data: Uint8ClampedArray, width: number, height: number): number => {
    // Check if there are consistent colors across different regions (indicating watermark)
    const colorMap = new Map<string, number>();
    
    for (let i = 0; i < data.length; i += 400) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Only consider semi-transparent pixels
      if (a > 50 && a < 240) {
        const key = `${Math.floor(r / 20)}-${Math.floor(g / 20)}-${Math.floor(b / 20)}`;
        colorMap.set(key, (colorMap.get(key) || 0) + 1);
      }
    }
    
    // If there's a dominant semi-transparent color, likely a watermark
    const maxOccurrence = Math.max(...Array.from(colorMap.values()));
    const totalSamples = Array.from(colorMap.values()).reduce((a, b) => a + b, 0);
    
    return totalSamples > 0 ? Math.min(1, (maxOccurrence / totalSamples) * 2) : 0;
  };

  const calculateSimilarity = (sample1: number[], sample2: number[]): number => {
    if (sample1.length !== sample2.length) return 0;
    
    let totalDiff = 0;
    for (let i = 0; i < sample1.length; i++) {
      totalDiff += Math.abs(sample1[i] - sample2[i]);
    }
    
    const maxDiff = sample1.length * 255;
    return 1 - (totalDiff / maxDiff);
  };

  // Auto-detect when image changes
  React.useEffect(() => {
    if (autoDetect && image && !isDetecting) {
      detectWatermark();
    }
  }, [image, autoDetect]);

  return (
    <div className="space-y-4">
      {!autoDetect && (
        <Button
          onClick={detectWatermark}
          disabled={!image || isDetecting}
          className="w-full"
          variant="outline"
        >
          <Shield className="mr-2 h-4 w-4" />
          {isDetecting ? 'Detecting...' : 'Detect Existing Watermark'}
        </Button>
      )}

      {isDetecting && (
        <div className="flex items-center justify-center py-4">
          <Shield className="h-5 w-5 animate-pulse mr-2" />
          <span className="text-sm text-muted-foreground">Scanning for watermarks...</span>
        </div>
      )}

      {detectionResult && !isDetecting && (
        <Alert 
          variant={
            detectionResult.hasWatermark && detectionResult.confidence >= 70 
              ? "destructive" 
              : "default"
          }
          className={
            detectionResult.hasWatermark && detectionResult.confidence < 70
              ? "border-red-600 bg-red-50 dark:bg-red-950/20"
              : ""
          }
        >
          {detectionResult.hasWatermark ? (
            <AlertTriangle className={detectionResult.confidence < 70 ? "h-4 w-4 text-red-600" : "h-4 w-4"} />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertTitle className={detectionResult.hasWatermark && detectionResult.confidence < 70 ? "text-red-600" : ""}>
            {detectionResult.hasWatermark ? 'Watermark Detected!' : 'No Watermark Detected'}
          </AlertTitle>
          <AlertDescription className={detectionResult.hasWatermark && detectionResult.confidence < 70 ? "text-red-600" : ""}>
            <p className="mb-2">{detectionResult.reason}</p>
            <p className="text-xs">
              Confidence: {detectionResult.confidence}%
            </p>
            {detectionResult.hasWatermark && detectionResult.confidence >= 70 && (
              <p className="mt-2">
                This image appears to already have a watermark. Adding another watermark is disabled.
              </p>
            )}
            {detectionResult.hasWatermark && detectionResult.confidence < 70 && (
              <p className="mt-2">
                Low confidence detection. You may proceed with caution.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
