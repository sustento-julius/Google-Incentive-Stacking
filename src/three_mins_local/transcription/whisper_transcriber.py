"""Video -> audio -> timestamped transcript via Whisper.

This is an *optional* path used only when a meeting has video but no CART
transcript. It is intentionally isolated so the core pipeline never imports
yt-dlp / ffmpeg / whisper unless this path is actually taken.

Supported backends (set TML_WHISPER_BACKEND):
    - faster-whisper  (recommended; CPU-friendly)
    - openai-whisper

Produces transcript text in the same ">> SPEAKER [HH:MM:SS]" convention the
parser understands. Whisper does not diarize by default, so speakers are left
generic ("SPEAKER") and the downstream classifier relies on content + context.
"""
from __future__ import annotations

import logging
import subprocess
import tempfile
from pathlib import Path

from ..config import Settings

log = logging.getLogger(__name__)


class WhisperTranscriber:
    def __init__(self, settings: Settings):
        self.settings = settings

    def transcribe_url(self, video_url: str) -> str:
        with tempfile.TemporaryDirectory() as tmp:
            audio_path = self._extract_audio(video_url, Path(tmp))
            segments = self._run_whisper(audio_path)
        return self._format_segments(segments)

    def _extract_audio(self, video_url: str, workdir: Path) -> Path:
        """Use yt-dlp + ffmpeg to download audio as 16kHz mono wav."""
        out = workdir / "audio.wav"
        cmd = [
            "yt-dlp", "-x", "--audio-format", "wav",
            "--postprocessor-args", "-ar 16000 -ac 1",
            "-o", str(workdir / "audio.%(ext)s"),
            video_url,
        ]
        log.info("Extracting audio: %s", " ".join(cmd))
        subprocess.run(cmd, check=True, capture_output=True)
        if out.exists():
            return out
        # yt-dlp may name it differently; grab the first wav.
        wavs = list(workdir.glob("*.wav"))
        if not wavs:
            raise RuntimeError("Audio extraction produced no .wav file")
        return wavs[0]

    def _run_whisper(self, audio_path: Path) -> list[tuple[float, float, str]]:
        backend = self.settings.whisper_backend
        model = self.settings.whisper_model
        if backend == "faster-whisper":
            from faster_whisper import WhisperModel

            wm = WhisperModel(model, device="cpu", compute_type="int8")
            seg_iter, _info = wm.transcribe(str(audio_path), vad_filter=True)
            return [(s.start, s.end, s.text.strip()) for s in seg_iter]
        elif backend == "openai-whisper":
            import whisper

            wm = whisper.load_model(model)
            result = wm.transcribe(str(audio_path))
            return [
                (s["start"], s["end"], s["text"].strip())
                for s in result.get("segments", [])
            ]
        raise ValueError(f"Unknown whisper backend: {backend!r}")

    @staticmethod
    def _format_segments(segments: list[tuple[float, float, str]]) -> str:
        lines: list[str] = []
        for start, _end, text in segments:
            ts = _seconds_to_hms(start)
            lines.append(f">> SPEAKER [{ts}]: {text}")
        return "\n".join(lines)


def _seconds_to_hms(seconds: float) -> str:
    s = int(seconds)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}"
