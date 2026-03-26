import React, { useEffect, useState, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Play, Film, X, Video } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

const Videos = () => {
  const [videos, setVideos] = useState([]);
  const [activeVideo, setActiveVideo] = useState(null);
  const playerRef = useRef(null);
  useEffect(() => {
    fetch("http://localhost:3000/videos")
      .then(res => res.json())
      .then(setVideos)
      .catch(console.error);
  }, []);

  const openPlayer = (url) => setActiveVideo(url);

  const closePlayer = () => {
    if (playerRef.current) playerRef.current.pause();
    setActiveVideo(null);
  };

 const getFileName = (url) => {
  const fileName = url.split('/').pop().replace(/\.[^/.]+$/, '');
  return fileName.toLowerCase();
};
  const getExt = (url) => url.split('.').pop();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-end justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Film className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Video Gallery</h1>
            </div>
            {videos.length > 0 && (
              <Badge variant="secondary" className="text-xs mb-1">
                {videos.length} video{videos.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <Separator />
        </div>

        {/* Empty State */}
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-muted-foreground">
            <div className="p-5 rounded-full bg-muted">
              <Video className="w-10 h-10 opacity-50" />
            </div>
            <div className="text-center">
              <p className="font-medium text-base">No videos available</p>
              <p className="text-sm mt-1 opacity-70">Videos fetched from the server will appear here</p>
            </div>
          </div>
        ) : (
          /* Video Grid */
          <ScrollArea className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {videos.map((url, i) => (
                <Card
                  key={i}
                  className="group overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 border-border/60 hover:border-primary/40 p-0"
                  onClick={() => openPlayer(url)}
                >
                  <CardContent className="p-0">
                    {/* Thumbnail */}
                    <div className="relative w-full aspect-video bg-muted overflow-hidden">
                      <video
                        src={url}
                        preload="metadata"
                        muted
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {/* Play Overlay */}
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
                        </div>
                      </div>
                      {/* Format Badge */}
                      <Badge
                        variant="secondary"
                        className="absolute top-2 right-2 text-[10px] font-bold tracking-wider opacity-80"
                      >
                        {getExt(url)}
                      </Badge>
                    </div>
                  </CardContent>

                  <CardFooter className="px-3 py-3 gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Play className="w-3.5 h-3.5 text-primary" fill="currentColor" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate capitalize leading-tight">
                        {getFileName(url)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Click to play
                      </p>
                       <Link to={`/videos/${getFileName(url)}/transcribe`} className="text- text-muted-foreground mt-0.5">
                       <Button className="m-4 cursor-pointer"> Click to Transcribe</Button>
                      </Link>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Modal Player */}
      <Dialog open={!!activeVideo} onOpenChange={(open) => !open && closePlayer()}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden gap-0">
          <DialogHeader className="px-5 py-3 border-b border-border flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="text-sm font-semibold capitalize truncate pr-4">
              {activeVideo ? getFileName(activeVideo) : ''}
            </DialogTitle>
          </DialogHeader>

          {/* Player */}
          <div className="w-full aspect-video bg-black">
            {activeVideo && (
              <video
                ref={playerRef}
                src={activeVideo}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>

          {/* Player Footer */}
          {activeVideo && (
            <div className="px-5 py-3 border-t border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-xs">
                  {activeVideo.split('/').pop()}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] font-bold tracking-wider">
                {getExt(activeVideo)}
              </Badge>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Videos;