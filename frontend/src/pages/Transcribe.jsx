import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Film, Play, Loader2, Download, Copy, Check, Terminal, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Transcribe = () => {
  const { name } = useParams();
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState(null);
  const [transcriptionFormat, setTranscriptionFormat] = useState('json');
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(null);
  const videoRef = useRef(null);
  const logsEndRef = useRef(null);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  useEffect(() => {
    fetch("http://localhost:3000/videos")
      .then(res => res.json())
      .then(data => {
        setVideos(data);
        const matchedVideo = data.find(video => {
          const fileName = video.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
          return fileName === name;
        });
        setSelectedVideo(matchedVideo || null);
      })
      .catch(console.error);
  }, [name]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !transcription?.segments) return;
    const interval = setInterval(() => {
      const currentTime = video.currentTime;
      const currentIdx = transcription.segments.findIndex(
        seg => currentTime >= seg.start && currentTime <= seg.end
      );
      setCurrentSegmentIdx(currentIdx !== -1 ? currentIdx : null);
    }, 200);
    return () => clearInterval(interval);
  }, [transcription]);

  const getFileName = (url) => url.split('/').pop().replace(/\.[^/.]+$/, '').toLowerCase();
  const getExt = (url) => url.split('.').pop();

  const handleTranscribe = async () => {
    if (!selectedVideo) return;
    setIsTranscribing(true);
    setTranscription(null);
    setLogs([]);
    setProgress(0);
    setStatus('extracting');
    setError(null);
    addLog(`Starting transcription for: ${getFileName(selectedVideo)}`, 'info');
    addLog(`Video URL: ${selectedVideo}`, 'info');
    addLog(`Output format: ${transcriptionFormat.toUpperCase()}`, 'info');

    try {
      const eventSource = new EventSource(
        `http://localhost:3000/transcribe-stream?videoUrl=${encodeURIComponent(selectedVideo)}&format=${transcriptionFormat}&task=transcribe&language=auto&word_timestamps=true&vad_filter=true`
      );
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'log':
              addLog(data.message, data.level || 'info');
              if (data.progress) setProgress(data.progress);
              break;
            case 'progress':
              setProgress(data.progress);
              setStatus(data.stage || 'processing');
              addLog(data.message, 'info');
              break;
            case 'result':
              setTranscription(data.data);
              setStatus('completed');
              setIsTranscribing(false);
              setProgress(100);
              addLog('Transcription completed successfully!', 'success');
              setLogs([]);
              eventSource.close();
              break;
            case 'error':
              setError(data.message);
              setStatus('error');
              addLog(`Error: ${data.message}`, 'error');
              eventSource.close();
              break;
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };
      eventSource.onerror = () => {
        addLog('Connection lost. Falling back...', 'warning');
        eventSource.close();
        fallbackTranscribe();
      };
      const timeout = setTimeout(() => {
        if (eventSource.readyState !== EventSource.CLOSED) {
          eventSource.close();
          setStatus('error');
          setError('Request timeout. Please try again.');
          setIsTranscribing(false);
        }
      }, 300000);
      return () => { clearTimeout(timeout); eventSource.close(); };
    } catch (error) {
      addLog(`Failed: ${error.message}`, 'error');
      setError(error.message);
      setStatus('error');
      setIsTranscribing(false);
    }
  };

  const fallbackTranscribe = async () => {
    addLog('Using fallback POST request...', 'warning');
    setStatus('extracting');
    try {
      const response = await fetch('http://localhost:3000/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl: selectedVideo, format: transcriptionFormat, task: 'transcribe', language: 'auto' }),
      });
      if (!response.ok) throw new Error(`Transcription failed: ${response.statusText}`);
      const interval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? clearInterval(interval) || 90 : prev + 10));
      }, 500);
      const data = await response.json();
      clearInterval(interval);
      setProgress(100);
      setTranscription(data);
      setStatus('completed');
      addLog('Transcription completed!', 'success');
    } catch (error) {
      addLog(`Failed: ${error.message}`, 'error');
      setError(error.message);
      setStatus('error');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscript = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(getEditedTranscript());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    if (!transcription) return;
    const content = getEditedTranscript();
    const mimeType = transcriptionFormat === 'json' ? 'application/json' : 'text/plain';
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getFileName(selectedVideo)}-transcript.${transcriptionFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getEditedTranscript = () => {
    if (transcriptionFormat === 'json') return JSON.stringify(transcription, null, 2);
    if (transcription.segments) {
      return transcription.segments.map((seg, i) =>
        `${i + 1}\n${formatTime(seg.start).replace('.', ',')} --> ${formatTime(seg.end).replace('.', ',')}\n${seg.text}\n`
      ).join('\n');
    }
    return transcription.text || '';
  };

  const formatTime = (seconds) => {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const getStatusColor = () => ({
    extracting: 'text-blue-500', transcribing: 'text-purple-500',
    completed: 'text-green-500', error: 'text-red-500',
  }[status] || 'text-muted-foreground');

  const getStatusText = () => ({
    extracting: 'Extracting audio...', transcribing: 'Transcribing with Whisper AI...',
    completed: 'Transcription complete!', error: 'Transcription failed',
  }[status] || 'Ready');

  const renderTranscription = () => {
    if (!transcription) return null;
    if (transcriptionFormat === 'json' && transcription.segments) {
      return (
        <div className="space-y-2">
          {transcription.segments.map((segment, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg transition-colors ${
                currentSegmentIdx === idx
                  ? 'bg-yellow-100 border-l-4 border-yellow-500'
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              {/* Timestamps always visible above the text */}
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground mb-1.5">
                <span className="bg-muted px-1.5 py-0.5 rounded">{formatTime(segment.start)}</span>
                <span>→</span>
                <span className="bg-muted px-1.5 py-0.5 rounded">{formatTime(segment.end)}</span>
              </div>
              <textarea
                className="w-full text-sm p-1.5 border border-border rounded resize-none bg-background"
                value={segment.text}
                rows={Math.max(1, Math.ceil(segment.text.length / 60))}
                onChange={(e) => {
                  const newSegments = [...transcription.segments];
                  newSegments[idx].text = e.target.value;
                  setTranscription({ ...transcription, segments: newSegments });
                }}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <pre className="p-4 bg-muted/30 rounded-lg text-sm whitespace-pre-wrap font-mono">
        {transcription.text || JSON.stringify(transcription, null, 2)}
      </pre>
    );
  };

  if (!selectedVideo) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="p-5 rounded-full bg-muted"><Film className="w-10 h-10 opacity-50" /></div>
          <div className="text-center">
            <p className="font-medium text-base">Video not found</p>
            <p className="text-sm mt-1 opacity-70">The requested video could not be found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    // Full-viewport layout — no page scroll, everything fits inside
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <div className="px-6 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Film className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Transcribe Video</h1>
          </div>
          <Badge variant="secondary" className="text-xs">{getExt(selectedVideo).toUpperCase()}</Badge>
        </div>
        <Separator />
        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* ── Main 3-column content area (fills remaining height) ── */}
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] gap-4">

          {/* ── Left: Video player ── */}
          <div className="flex flex-col gap-4 min-h-0">
            <Card className="flex flex-col overflow-hidden border-border/60 h-full">
              <CardContent className="p-0 flex-1 min-h-0">
                <div className="relative w-full h-full bg-black">
                  <video
                    ref={videoRef}
                    src={selectedVideo}
                    controls
                    className="w-full h-full object-contain"
                    preload="metadata"
                  />
                </div>
              </CardContent>
              <CardFooter className="px-4 py-3 gap-3 border-t border-border/60 flex-shrink-0">
                <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 text-primary" fill="currentColor" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize leading-tight">{getFileName(selectedVideo)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{selectedVideo.split('/').pop()}</p>
                </div>
              </CardFooter>
            </Card>
          </div>

          {/* ── Centre: Controls + Logs ── */}
          <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
            <Card className="border-border/60 flex-shrink-0">
              <CardContent className="p-5">
                <div className="flex flex-col gap-5">
                  <div className="text-center space-y-1">
                    <h3 className="text-base font-semibold">Ready to Transcribe</h3>
                    <p className="text-xs text-muted-foreground truncate">"{getFileName(selectedVideo)}"</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output Format</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['json', 'srt', 'vtt'].map(fmt => (
                        <Button
                          key={fmt}
                          variant={transcriptionFormat === fmt ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setTranscriptionFormat(fmt)}
                          disabled={isTranscribing}
                        >
                          {fmt.toUpperCase()}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {isTranscribing && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className={getStatusColor()}>{getStatusText()}</span>
                        <span className="text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5" />
                    </div>
                  )}

                  <Button onClick={handleTranscribe} disabled={isTranscribing} className="w-full cursor-pointer" size="lg">
                    {isTranscribing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                    ) : (
                      <><Play className="mr-2 h-4 w-4" fill="currentColor" />Start Transcription</>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {logs.length > 0 && (
              <Card className="border-border/60 flex-shrink-0">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Logs</h4>
                    <Badge variant="secondary" className="text-xs">{logs.length}</Badge>
                  </div>
                  <ScrollArea className="h-[160px]">
                    <div className="space-y-1 font-mono text-xs">
                      {logs.map((log, idx) => (
                        <div key={idx} className={`py-0.5 border-l-2 pl-2 ${
                          log.type === 'error' ? 'border-red-500 text-red-600' :
                          log.type === 'warning' ? 'border-yellow-500 text-yellow-600' :
                          log.type === 'success' ? 'border-green-500 text-green-600' :
                          'border-blue-500 text-muted-foreground'
                        }`}>
                          <span className="opacity-60">[{log.timestamp}]</span>{' '}
                          <span>{log.message}</span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right: Scrollable transcript panel ── */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            <Card className="border-border/60 flex flex-col h-full overflow-hidden">
              {/* Sticky header inside the transcript card */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/60 flex-shrink-0 bg-card">
                <h3 className="text-base font-semibold">
                  {transcription ? 'Transcript' : 'Transcript'}
                </h3>
                {transcription && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopyTranscript}>
                      {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadTranscript}>
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Download
                    </Button>
                  </div>
                )}
              </div>

              {/* Scrollable transcript body */}
              <div className="flex-1 overflow-y-auto p-4">
                {transcription ? (
                  renderTranscription()
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted/50">
                      <Film className="w-8 h-8 opacity-30" />
                    </div>
                    <p className="text-sm">Transcript will appear here</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Transcribe;