// 기능영상 v2 개별 데모(장면 1개 + 새 로고 끝 화면) 렌더 → out/feature_demo_<장면>_1080.mp4, 이어서 ffmpeg 로 720x1280 out/feature_demo_<장면>.mp4
// 사용: node scripts/render_feature_demos.mjs [장면키 ...]   (키: a_match b_pick b_plan c_coach d_photo e_expiry f_listen g_family)
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import path from "node:path";

const keys = process.argv.slice(2);
const all = ["a_match", "b_pick", "b_plan", "c_coach", "d_photo", "e_expiry", "f_listen", "g_family"];
const todo = keys.length ? keys : all;
const entry = path.resolve("src/index.ts");
const serveUrl = await bundle({ entryPoint: entry });
for (const k of todo) {
  const id = `FeatureDemo-${k.replace(/_/g, "-")}`;
  const comp = await selectComposition({ serveUrl, id });
  const out1080 = `out/feature_demo_${k}_1080.mp4`;
  await renderMedia({ composition: comp, serveUrl, codec: "h264", crf: 18, outputLocation: out1080 });
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", out1080, "-vf", "scale=720:1280:flags=lanczos,fps=30", "-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", `out/feature_demo_${k}.mp4`]);
  console.log("done", k, (comp.durationInFrames / 30).toFixed(1) + "s");
}
