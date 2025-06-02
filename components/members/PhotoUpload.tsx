import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, X } from 'lucide-react';
import { Button } from '../ui/button';

interface PhotoUploadProps {
  photoUrl?: string;
  onPhotoSelect: (file: File) => void;
}

export function PhotoUpload({ photoUrl, onPhotoSelect }: PhotoUploadProps) {
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // Clean up function to ensure camera is stopped when component unmounts
    return () => {
      stopCamera();
    };
  }, []);

  // Ensure video element is ready when camera modal is shown
  useEffect(() => {
    if (showCamera && videoRef.current && !stream) {
      initializeCamera();
    }
  }, [showCamera]);

  const initializeCamera = async () => {
    try {
      setError(null);
      setIsVideoReady(false);

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });

      if (!videoRef.current) {
        throw new Error('Video element not found');
      }

      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);

      // Wait for video to be loaded
      await new Promise((resolve) => {
        if (!videoRef.current) return;
        videoRef.current.onloadedmetadata = () => resolve(true);
      });

      await videoRef.current.play();
      setIsVideoReady(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError(err instanceof Error ? err.message : 'Unable to access camera');
      stopCamera();
    }
  };

  const startCamera = () => {
    setShowCamera(true);
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
    setShowCamera(false);
    setIsVideoReady(false);
    setError(null);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || !isVideoReady) {
      setError('Camera not ready');
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Could not get canvas context');
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
          onPhotoSelect(file);
          stopCamera();
        } else {
          throw new Error('Failed to create image file');
        }
      }, 'image/jpeg', 0.8);
    } catch (err) {
      console.error('Error capturing photo:', err);
      setError(err instanceof Error ? err.message : 'Failed to capture photo');
    }
  };

  return (
    <>
      <div className="flex flex-col items-center">
        <div className="w-32 h-32 relative rounded-lg overflow-hidden bg-gray-100">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt="Member preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Upload className="h-8 w-8" />
            </div>
          )}
        </div>
        
        <div className="mt-4 flex space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => document.getElementById('photo-upload')?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={startCamera}
          >
            <Camera className="mr-2 h-4 w-4" />
            Camera
          </Button>
          <input
            id="photo-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onPhotoSelect(file);
              }
            }}
          />
        </div>
      </div>

      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Take Photo</h3>
              <Button variant="ghost" size="sm" onClick={stopCamera}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="p-4">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-black">
                {!isVideoReady && !error && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-white text-center px-4">{error}</p>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoReady ? 'opacity-100' : 'opacity-0'}`}
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
              </div>
              
              <div className="mt-4 flex justify-center space-x-4">
                <Button
                  type="button"
                  onClick={capturePhoto}
                  className="w-32"
                  disabled={!isVideoReady || !!error}
                >
                  Capture
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={stopCamera}
                  className="w-32"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}