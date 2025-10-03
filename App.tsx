import { useState, useRef } from 'react';
import { WatermarkCreator, WatermarkConfig } from './components/WatermarkCreator';
import { ImageCanvas } from './components/ImageCanvas';
import { WatermarkDetector } from './components/WatermarkDetector';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Upload, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    type: 'text',
    text: '',
    fontSize: 48,
    color: '#000000',
    opacity: 0.3,
    rotation: -45,
    spacing: 250,
    imageSize: 20,
  });
  const [hasWatermark, setHasWatermark] = useState(false);
  const [detectionDone, setDetectionDone] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setDetectionDone(false);
          setHasWatermark(false);
          toast.success('Image loaded successfully');
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) {
      toast.error('No image to download');
      return;
    }

    if (hasWatermark && detectionDone && detectionConfidence >= 70) {
      toast.error('Cannot download - existing watermark detected with high confidence');
      return;
    }

    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `watermarked-image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Image downloaded successfully');
      }
    });
  };

  const handleDetectionComplete = (detected: boolean, confidence: number) => {
    setHasWatermark(detected);
    setDetectionConfidence(confidence);
    setDetectionDone(true);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Toaster />
      
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1>Watermark Studio</h1>
          <p className="text-muted-foreground">
            Create custom tiled watermarks and apply them across your images with built-in detection
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Upload & Detection */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload Image</CardTitle>
                <CardDescription>
                  Select an image to watermark
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  variant="outline"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>
                
                {image && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Image loaded: {image.width} × {image.height}px
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {image && (
              <Card>
                <CardHeader>
                  <CardTitle>Watermark Detection</CardTitle>
                  <CardDescription>
                    Automatic watermark detection
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <WatermarkDetector
                    image={image}
                    onDetectionComplete={handleDetectionComplete}
                    autoDetect={true}
                  />
                </CardContent>
              </Card>
            )}

            {/* Watermark Creator */}
            <WatermarkCreator
              config={watermarkConfig}
              onConfigChange={setWatermarkConfig}
            />
          </div>

          {/* Right Column - Preview */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>
                  See how your watermark will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasWatermark && detectionDone && detectionConfidence < 70 && (
                  <Alert className="mb-4 border-red-600 bg-red-50 dark:bg-red-950/20">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <AlertDescription className="text-red-600">
                      <span className="font-semibold">WATERMARK DETECTED</span> (Low Confidence: {detectionConfidence}%)
                      <br />
                      This image may have a watermark. Proceed with caution.
                    </AlertDescription>
                  </Alert>
                )}
                {hasWatermark && detectionDone && detectionConfidence >= 70 && (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Watermark detected! (Confidence: {detectionConfidence}%)
                      <br />
                      This image already appears to have a watermark. Applying another watermark is disabled.
                    </AlertDescription>
                  </Alert>
                )}
                
                <ImageCanvas
                  image={image}
                  watermarkConfig={watermarkConfig}
                  onCanvasReady={(canvas) => {
                    canvasRef.current = canvas;
                  }}
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            {image && (
              <div className="flex gap-4">
                <Button
                  onClick={handleDownload}
                  disabled={hasWatermark && detectionDone && detectionConfidence >= 70}
                  className="flex-1"
                  size="lg"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Watermarked Image
                </Button>
              </div>
            )}

            {/* Instructions */}
            {!image && (
              <Card>
                <CardHeader>
                  <CardTitle>How to Use</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                    <li>Upload an image using the "Choose Image" button</li>
                    <li>Watermark detection runs automatically on upload</li>
                    <li>Create your custom watermark using text or an image</li>
                    <li>Adjust opacity, rotation, spacing, and other settings</li>
                    <li>Preview the tiled watermark pattern in real-time</li>
                    <li>Download the final watermarked image</li>
                  </ol>
                  <Alert className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Images with detected watermarks will be blocked from receiving additional watermarks
                      to prevent unauthorized duplication.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
