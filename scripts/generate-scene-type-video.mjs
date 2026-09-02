import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const outputPath = fileURLToPath(
  new URL("../public/scene-type-atmosphere.webm", import.meta.url),
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const dataUrl = await page.evaluate(async () => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D is unavailable");
  }

  canvas.width = 960;
  canvas.height = 540;
  const stream = canvas.captureStream(18);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm;codecs=vp8";
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 900_000,
  });
  const chunks = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  const stopped = new Promise((resolve) => {
    recorder.addEventListener("stop", resolve, { once: true });
  });

  recorder.start();
  const startedAt = performance.now();

  await new Promise((resolve) => {
    function draw(timestamp) {
      const elapsed = timestamp - startedAt;
      const phase = elapsed / 1400;
      const sky = context.createLinearGradient(0, 0, canvas.width, canvas.height);

      sky.addColorStop(0, "#173f5d");
      sky.addColorStop(0.5, "#4d8290");
      sky.addColorStop(1, "#e9b66e");
      context.fillStyle = sky;
      context.fillRect(0, 0, canvas.width, canvas.height);

      const flareX = 705 + Math.sin(phase * Math.PI * 2) * 42;
      const flare = context.createRadialGradient(flareX, 132, 8, flareX, 132, 190);

      flare.addColorStop(0, "rgba(255,241,187,.94)");
      flare.addColorStop(0.35, "rgba(246,164,93,.68)");
      flare.addColorStop(1, "rgba(228,102,78,0)");
      context.fillStyle = flare;
      context.fillRect(0, 0, canvas.width, canvas.height);

      context.fillStyle = "rgba(17,43,58,.66)";
      context.beginPath();
      context.moveTo(-80, 480);
      context.bezierCurveTo(180, 295, 390, 405, 590, 300);
      context.bezierCurveTo(745, 220, 840, 205, 1040, 275);
      context.lineTo(1040, 540);
      context.lineTo(-80, 540);
      context.fill();

      context.fillStyle = "rgba(24,35,38,.82)";
      context.beginPath();
      context.moveTo(-60, 520);
      context.bezierCurveTo(230, 365, 430, 460, 660, 355);
      context.bezierCurveTo(790, 295, 900, 300, 1020, 360);
      context.lineTo(1020, 540);
      context.lineTo(-60, 540);
      context.fill();

      context.strokeStyle = "rgba(249,214,150,.38)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(50, 155);
      context.bezierCurveTo(250, 215, 365, 58, 535, 148);
      context.bezierCurveTo(680, 225, 770, 100, 920, 125);
      context.stroke();

      if (elapsed < 1400) {
        requestAnimationFrame(draw);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(draw);
  });

  recorder.stop();
  await stopped;
  stream.getTracks().forEach((track) => track.stop());
  const blob = new Blob(chunks, { type: mimeType });

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => resolve(String(reader.result)), {
      once: true,
    });
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
});

await browser.close();
writeFileSync(outputPath, Buffer.from(dataUrl.split(",")[1], "base64"));
console.log(`Generated ${outputPath}`);
