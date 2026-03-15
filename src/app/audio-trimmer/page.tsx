"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  Music,
  Pause,
  Play,
  Square,
  Upload,
  Volume2,
  Gauge,
  Timer,
  FileAudio,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ExportFormat = "wav";
type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ACCEPTED_FORMATS = ".mp3,.wav,.ogg,.m4a,.flac,audio/*";
const SPEED_OPTIONS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];
const HANDLE_WIDTH = 8;
const MIN_SELECTION_PX = 4;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00.000";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toFixed(3).padStart(6, "0")}`;
}

function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0.000s";
  if (seconds < 60) return `${seconds.toFixed(3)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toFixed(1)}s`;
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/* ------------------------------------------------------------------ */
/*  WAV Encoder                                                        */
/* ------------------------------------------------------------------ */

function audioBufferToWav(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  fadeInSec: number,
  fadeOutSec: number,
): Blob {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.min(Math.floor(endSec * sampleRate), buffer.length);
  const length = endSample - startSample;

  if (length <= 0) {
    return new Blob([], { type: "audio/wav" });
  }

  const fadeInSamples = Math.min(Math.floor(fadeInSec * sampleRate), length);
  const fadeOutSamples = Math.min(Math.floor(fadeOutSec * sampleRate), length);

  // Interleave channels and apply fades
  const interleaved = new Float32Array(length * numChannels);
  for (let ch = 0; ch < numChannels; ch++) {
    const channelData = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      let sample = channelData[startSample + i];

      // Fade in
      if (i < fadeInSamples && fadeInSamples > 0) {
        sample *= i / fadeInSamples;
      }
      // Fade out
      if (i >= length - fadeOutSamples && fadeOutSamples > 0) {
        sample *= (length - i) / fadeOutSamples;
      }

      interleaved[i * numChannels + ch] = sample;
    }
  }

  // Encode to 16-bit PCM WAV
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = interleaved.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, totalSize - 8, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // PCM samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const s = Math.max(-1, Math.min(1, interleaved[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AudioTrimmerPage() {
  // Audio state
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);

  // Selection (in seconds)
  const [selStart, setSelStart] = useState(0);
  const [selEnd, setSelEnd] = useState(0);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPos, setPlaybackPos] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const playStartTimeRef = useRef(0);
  const playOffsetRef = useRef(0);
  const animFrameRef = useRef(0);

  // Settings
  const [volume, setVolume] = useState(100);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [fadeIn, setFadeIn] = useState(false);
  const [fadeInDuration, setFadeInDuration] = useState(1);
  const [fadeOut, setFadeOut] = useState(false);
  const [fadeOutDuration, setFadeOutDuration] = useState(1);
  const [exportFormat] = useState<ExportFormat>("wav");

  // Canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(800);
  const canvasHeight = 180;

  // Drag state
  const [dragging, setDragging] = useState<"start" | "end" | "region" | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartSelRef = useRef({ start: 0, end: 0 });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---- Audio context ---- */
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  /* ---- Resize observer ---- */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w > 0) setCanvasWidth(w);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  /* ---- Compute peaks when buffer or canvas width changes ---- */
  useEffect(() => {
    if (!audioBuffer) {
      setPeaks([]);
      return;
    }
    const rawData = audioBuffer.getChannelData(0);
    const samples = canvasWidth;
    const blockSize = Math.floor(rawData.length / samples);
    if (blockSize === 0) return;

    const newPeaks: number[] = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(rawData[i * blockSize + j]);
      }
      newPeaks.push(sum / blockSize);
    }
    setPeaks(newPeaks);
  }, [audioBuffer, canvasWidth]);

  /* ---- Draw waveform ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = canvasHeight * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (peaks.length === 0 || duration === 0) {
      // Empty state
      ctx.fillStyle = "var(--muted)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Upload an audio file to see the waveform", canvasWidth / 2, canvasHeight / 2);
      return;
    }

    const maxPeak = Math.max(...peaks);
    if (maxPeak === 0) return;

    const selStartPx = (selStart / duration) * canvasWidth;
    const selEndPx = (selEnd / duration) * canvasWidth;

    // Draw dimmed regions (outside selection)
    ctx.fillStyle = "rgba(128, 128, 128, 0.15)";
    ctx.fillRect(0, 0, selStartPx, canvasHeight);
    ctx.fillRect(selEndPx, 0, canvasWidth - selEndPx, canvasHeight);

    // Draw selected region highlight
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue("--accent").trim() || "#6366f1";
    ctx.fillStyle = accent + "18";
    ctx.fillRect(selStartPx, 0, selEndPx - selStartPx, canvasHeight);

    // Draw waveform bars
    peaks.forEach((peak, i) => {
      const h = (peak / maxPeak) * canvasHeight * 0.8;
      const x = i;
      const y = (canvasHeight - h) / 2;

      if (x >= selStartPx && x <= selEndPx) {
        ctx.fillStyle = accent;
      } else {
        ctx.fillStyle = "var(--muted)";
      }
      ctx.fillRect(x, y, 1, h);
    });

    // Draw time axis
    ctx.fillStyle = "var(--muted)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

    const tickCount = Math.min(Math.floor(canvasWidth / 80), 20);
    const tickInterval = duration / tickCount;
    for (let i = 0; i <= tickCount; i++) {
      const t = i * tickInterval;
      const x = (t / duration) * canvasWidth;

      ctx.fillStyle = "var(--border)";
      ctx.fillRect(x, canvasHeight - 16, 1, 6);

      ctx.fillStyle = "var(--muted)";
      ctx.fillText(formatTime(t), x, canvasHeight - 1);
    }

    // Draw selection handles
    const drawHandle = (px: number) => {
      ctx.fillStyle = accent;
      ctx.fillRect(px - 1.5, 0, 3, canvasHeight - 18);

      // Handle grip
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(px - HANDLE_WIDTH / 2, canvasHeight * 0.3 - 14, HANDLE_WIDTH, 28, 3);
      ctx.fill();

      // Grip dots
      ctx.fillStyle = "#fff";
      for (let dy = -4; dy <= 4; dy += 4) {
        ctx.beginPath();
        ctx.arc(px, canvasHeight * 0.3 + dy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    drawHandle(selStartPx);
    drawHandle(selEndPx);

    // Draw playback position line
    if (isPlaying || playbackPos > 0) {
      const posPx = (playbackPos / duration) * canvasWidth;
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(posPx, 0);
      ctx.lineTo(posPx, canvasHeight - 18);
      ctx.stroke();
    }

    // Draw time labels at handles
    ctx.font = "10px monospace";
    ctx.textBaseline = "top";

    // Start handle label
    ctx.fillStyle = accent;
    const startLabel = formatTime(selStart);
    const startLabelWidth = ctx.measureText(startLabel).width + 6;
    const startLabelX = Math.max(0, Math.min(selStartPx - startLabelWidth / 2, canvasWidth - startLabelWidth));
    ctx.beginPath();
    ctx.roundRect(startLabelX, 2, startLabelWidth, 14, 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(startLabel, startLabelX + startLabelWidth / 2, 4);

    // End handle label
    ctx.fillStyle = accent;
    const endLabel = formatTime(selEnd);
    const endLabelWidth = ctx.measureText(endLabel).width + 6;
    const endLabelX = Math.max(0, Math.min(selEndPx - endLabelWidth / 2, canvasWidth - endLabelWidth));
    ctx.beginPath();
    ctx.roundRect(endLabelX, 2, endLabelWidth, 14, 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.fillText(endLabel, endLabelX + endLabelWidth / 2, 4);
  }, [peaks, canvasWidth, canvasHeight, selStart, selEnd, duration, playbackPos, isPlaying]);

  /* ---- File upload ---- */
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      stopPlayback();
      setFileName(file.name);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const ctx = getAudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);

        setAudioBuffer(decoded);
        setDuration(decoded.duration);
        setSelStart(0);
        setSelEnd(decoded.duration);
        setPlaybackPos(0);
      } catch {
        alert("Failed to decode audio file. Please try a different format.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getAudioContext],
  );

  /* ---- Playback ---- */
  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        /* already stopped */
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
    cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
  }, []);

  const updatePlaybackPosition = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !isPlaying) return;

    const elapsed = (ctx.currentTime - playStartTimeRef.current) * speed;
    const currentPos = playOffsetRef.current + elapsed;
    setPlaybackPos(currentPos);

    if (currentPos < selEnd) {
      animFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
    } else {
      setPlaybackPos(selEnd);
      stopPlayback();
    }
  }, [isPlaying, speed, selEnd, stopPlayback]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
    }
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, updatePlaybackPosition]);

  const playAudio = useCallback(
    (start: number, end: number) => {
      if (!audioBuffer) return;

      stopPlayback();

      const ctx = getAudioContext();
      if (ctx.state === "suspended") ctx.resume();

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = speed;

      const gainNode = ctx.createGain();
      gainNode.gain.value = volume / 100;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.onended = () => {
        stopPlayback();
      };

      const dur = end - start;
      source.start(0, start, dur);

      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      playStartTimeRef.current = ctx.currentTime;
      playOffsetRef.current = start;
      setPlaybackPos(start);
      setIsPlaying(true);
    },
    [audioBuffer, speed, volume, getAudioContext, stopPlayback],
  );

  const handlePlaySelection = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    playAudio(selStart, selEnd);
  }, [isPlaying, selStart, selEnd, playAudio, stopPlayback]);

  const handlePlayFull = useCallback(() => {
    if (isPlaying) stopPlayback();
    playAudio(0, duration);
  }, [isPlaying, duration, playAudio, stopPlayback]);

  const handleStop = useCallback(() => {
    stopPlayback();
    setPlaybackPos(selStart);
  }, [stopPlayback, selStart]);

  /* ---- Update gain in real time ---- */
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume / 100;
    }
  }, [volume]);

  /* ---- Drag interaction ---- */
  const getTimeFromX = useCallback(
    (clientX: number) => {
      const canvas = canvasRef.current;
      if (!canvas || duration === 0) return 0;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      return clamp((x / rect.width) * duration, 0, duration);
    },
    [duration],
  );

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!audioBuffer || duration === 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;

      const selStartPx = (selStart / duration) * rect.width;
      const selEndPx = (selEnd / duration) * rect.width;

      const hitZone = HANDLE_WIDTH + 4;

      // Check handle hit
      if (Math.abs(x - selStartPx) < hitZone) {
        setDragging("start");
        dragStartXRef.current = e.clientX;
        dragStartSelRef.current = { start: selStart, end: selEnd };
        e.preventDefault();
        return;
      }
      if (Math.abs(x - selEndPx) < hitZone) {
        setDragging("end");
        dragStartXRef.current = e.clientX;
        dragStartSelRef.current = { start: selStart, end: selEnd };
        e.preventDefault();
        return;
      }

      // Check region drag
      if (x > selStartPx + hitZone && x < selEndPx - hitZone) {
        setDragging("region");
        dragStartXRef.current = e.clientX;
        dragStartSelRef.current = { start: selStart, end: selEnd };
        e.preventDefault();
        return;
      }

      // Click outside selection: move nearest handle
      const time = getTimeFromX(e.clientX);
      if (Math.abs(time - selStart) < Math.abs(time - selEnd)) {
        setSelStart(time);
      } else {
        setSelEnd(time);
      }
    },
    [audioBuffer, duration, selStart, selEnd, getTimeFromX],
  );

  const handleCanvasMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging || duration === 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const minTimeDelta = (MIN_SELECTION_PX / rect.width) * duration;

      if (dragging === "start") {
        const time = getTimeFromX(e.clientX);
        setSelStart(clamp(time, 0, selEnd - minTimeDelta));
      } else if (dragging === "end") {
        const time = getTimeFromX(e.clientX);
        setSelEnd(clamp(time, selStart + minTimeDelta, duration));
      } else if (dragging === "region") {
        const dx = e.clientX - dragStartXRef.current;
        const timeDelta = (dx / rect.width) * duration;
        const origDur = dragStartSelRef.current.end - dragStartSelRef.current.start;

        let newStart = dragStartSelRef.current.start + timeDelta;
        let newEnd = dragStartSelRef.current.end + timeDelta;

        if (newStart < 0) {
          newStart = 0;
          newEnd = origDur;
        }
        if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - origDur;
        }

        setSelStart(newStart);
        setSelEnd(newEnd);
      }
    },
    [dragging, duration, selStart, selEnd, getTimeFromX],
  );

  const handleCanvasMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleCanvasMouseMove);
      window.addEventListener("mouseup", handleCanvasMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleCanvasMouseMove);
        window.removeEventListener("mouseup", handleCanvasMouseUp);
      };
    }
  }, [dragging, handleCanvasMouseMove, handleCanvasMouseUp]);

  /* ---- Double-click to reset selection ---- */
  const handleCanvasDoubleClick = useCallback(() => {
    if (duration > 0) {
      setSelStart(0);
      setSelEnd(duration);
    }
  }, [duration]);

  /* ---- Canvas cursor ---- */
  const getCanvasCursor = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!audioBuffer || duration === 0) return "default";
      const canvas = canvasRef.current;
      if (!canvas) return "default";
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const selStartPx = (selStart / duration) * rect.width;
      const selEndPx = (selEnd / duration) * rect.width;
      const hitZone = HANDLE_WIDTH + 4;

      if (Math.abs(x - selStartPx) < hitZone || Math.abs(x - selEndPx) < hitZone) {
        return "ew-resize";
      }
      if (x > selStartPx + hitZone && x < selEndPx - hitZone) {
        return "grab";
      }
      return "crosshair";
    },
    [audioBuffer, duration, selStart, selEnd],
  );

  const [canvasCursor, setCanvasCursor] = useState("default");

  const handleCanvasHover = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragging) {
        setCanvasCursor(dragging === "region" ? "grabbing" : "ew-resize");
        return;
      }
      setCanvasCursor(getCanvasCursor(e));
    },
    [dragging, getCanvasCursor],
  );

  /* ---- Export ---- */
  const handleExport = useCallback(() => {
    if (!audioBuffer) return;

    const blob = audioBufferToWav(
      audioBuffer,
      selStart,
      selEnd,
      fadeIn ? fadeInDuration : 0,
      fadeOut ? fadeOutDuration : 0,
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = fileName.replace(/\.[^.]+$/, "") || "trimmed";
    a.href = url;
    a.download = `${baseName}-trimmed.${exportFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audioBuffer, selStart, selEnd, fadeIn, fadeInDuration, fadeOut, fadeOutDuration, fileName, exportFormat]);

  /* ---- Cleanup ---- */
  useEffect(() => {
    return () => {
      stopPlayback();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Selection duration ---- */
  const selDuration = selEnd - selStart;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--background)]">
      {/* ---- Header ---- */}
      <header className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
        <Link
          href="/"
          className="w-7 h-7 rounded-lg hover:bg-[var(--surface-hover)] flex items-center justify-center text-[var(--muted)]"
        >
          <ArrowLeft size={14} />
        </Link>

        <div className="flex items-center gap-2 text-[var(--foreground)]">
          <Music size={14} />
          <span className="text-sm font-semibold">Audio Trimmer</span>
        </div>

        {fileName && (
          <span className="text-xs text-[var(--muted)] truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            <Upload size={12} />
            Upload
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={!audioBuffer}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Download size={12} />
            Export WAV
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FORMATS}
          onChange={handleFileUpload}
          className="hidden"
        />
      </header>

      {/* ---- Main content ---- */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Waveform area */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 pt-4 pb-2 min-h-0">
          {!audioBuffer ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full max-w-2xl h-48 border-2 border-dashed border-[var(--border)] rounded-xl hover:border-[var(--accent)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
            >
              <FileAudio size={36} className="text-[var(--muted)] mb-3" />
              <span className="text-sm text-[var(--foreground)] font-medium">
                Click to upload an audio file
              </span>
              <span className="text-xs text-[var(--muted)] mt-1">
                Supports MP3, WAV, OGG, M4A, FLAC
              </span>
            </button>
          ) : (
            <div ref={containerRef} className="w-full max-w-full">
              <canvas
                ref={canvasRef}
                width={canvasWidth}
                height={canvasHeight}
                style={{
                  width: canvasWidth,
                  height: canvasHeight,
                  cursor: dragging === "region" ? "grabbing" : canvasCursor,
                }}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)]"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasHover}
                onDoubleClick={handleCanvasDoubleClick}
              />

              {/* Selection info */}
              <div className="flex items-center justify-between mt-2 text-xs text-[var(--muted)] font-mono px-1">
                <span>Start: {formatTime(selStart)}</span>
                <span>Selection: {formatDuration(selDuration)}</span>
                <span>End: {formatTime(selEnd)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Transport controls */}
        {audioBuffer && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 flex-shrink-0">
            <button
              type="button"
              onClick={handlePlaySelection}
              title={isPlaying ? "Pause" : "Play selection"}
              className="w-9 h-9 rounded-full bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] flex items-center justify-center transition-colors"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={handleStop}
              title="Stop"
              className="w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] flex items-center justify-center transition-colors"
            >
              <Square size={14} />
            </button>

            <button
              type="button"
              onClick={handlePlayFull}
              title="Play full audio"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Play size={12} />
              Full
            </button>

            <span className="text-xs text-[var(--muted)] font-mono ml-2">
              {formatTime(playbackPos)} / {formatTime(duration)}
            </span>
          </div>
        )}

        {/* Settings panel */}
        {audioBuffer && (
          <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex-shrink-0">
            <div className="flex flex-wrap items-start gap-6 max-w-5xl mx-auto">
              {/* Volume */}
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                  <Volume2 size={12} />
                  Volume: {volume}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={200}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-full h-1.5 accent-[var(--accent)] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[var(--muted)]">
                  <span>0%</span>
                  <span>200%</span>
                </div>
              </div>

              {/* Speed */}
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                  <Gauge size={12} />
                  Speed
                </label>
                <div className="flex items-center gap-1 flex-wrap">
                  {SPEED_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setSpeed(s);
                        if (sourceRef.current) {
                          sourceRef.current.playbackRate.value = s;
                        }
                      }}
                      className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                        speed === s
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--surface-hover)] text-[var(--foreground)] hover:bg-[var(--border)]"
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Fade In */}
              <div className="flex flex-col gap-1.5 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                  <Timer size={12} />
                  Fade In
                  <button
                    type="button"
                    onClick={() => setFadeIn(!fadeIn)}
                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                      fadeIn
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)] text-[var(--muted)]"
                    }`}
                  >
                    {fadeIn ? "ON" : "OFF"}
                  </button>
                </label>
                {fadeIn && (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={fadeInDuration}
                      onChange={(e) => setFadeInDuration(Number(e.target.value))}
                      className="w-full h-1.5 accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-[10px] text-[var(--muted)]">{fadeInDuration.toFixed(1)}s</span>
                  </>
                )}
              </div>

              {/* Fade Out */}
              <div className="flex flex-col gap-1.5 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                  <Timer size={12} />
                  Fade Out
                  <button
                    type="button"
                    onClick={() => setFadeOut(!fadeOut)}
                    className={`ml-auto text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                      fadeOut
                        ? "bg-[var(--accent)] text-white"
                        : "bg-[var(--surface-hover)] text-[var(--muted)]"
                    }`}
                  >
                    {fadeOut ? "ON" : "OFF"}
                  </button>
                </label>
                {fadeOut && (
                  <>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.1}
                      value={fadeOutDuration}
                      onChange={(e) => setFadeOutDuration(Number(e.target.value))}
                      className="w-full h-1.5 accent-[var(--accent)] cursor-pointer"
                    />
                    <span className="text-[10px] text-[var(--muted)]">{fadeOutDuration.toFixed(1)}s</span>
                  </>
                )}
              </div>

              {/* Export Format */}
              <div className="flex flex-col gap-1.5 min-w-[150px]">
                <label className="flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
                  <FileAudio size={12} />
                  Export Format
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-[var(--accent)] text-white">
                    WAV
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    MP3 requires an external encoder library
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Footer ---- */}
      {audioBuffer && (
        <footer className="flex items-center gap-3 px-4 py-1.5 border-t border-[var(--border)] bg-[var(--surface)] flex-shrink-0">
          <span className="text-[11px] text-[var(--muted)]">
            {audioBuffer.numberOfChannels}ch &middot; {audioBuffer.sampleRate}Hz &middot;{" "}
            {formatDuration(audioBuffer.duration)}
          </span>
          <span className="text-[11px] text-[var(--muted)] ml-auto">
            Double-click waveform to reset selection
          </span>
        </footer>
      )}
    </div>
  );
}
