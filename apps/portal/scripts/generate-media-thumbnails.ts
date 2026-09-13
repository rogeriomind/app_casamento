import "dotenv/config";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const mediaRoot = process.env.MEDIA_DIR ?? path.join(process.cwd(), ".local", "media");
const maxSize = 1200;

async function main() {
  const files = (await readdir(mediaRoot)).filter((name) => name.endsWith(".webp") && !name.includes(".thumbnail-") && !name.includes(".original."));
  let created = 0;
  for (const filename of files) {
    const target = filename.replace(/\.webp$/i, `.thumbnail-${maxSize}.webp`);
    const targetPath = path.join(mediaRoot, target);
    try { await readFile(targetPath); continue; }
    catch { /* Generate the missing derivative below. */ }
    const source = await readFile(path.join(mediaRoot, filename));
    const thumbnail = await sharp(source, { limitInputPixels: 40_000_000, failOn: "error" })
      .resize({ width: maxSize, height: maxSize, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toBuffer();
    await writeFile(targetPath, thumbnail);
    created += 1;
  }
  console.log(`${created} miniaturas criadas; ${files.length - created} já existiam.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Não foi possível gerar as miniaturas.");
  process.exitCode = 1;
});
