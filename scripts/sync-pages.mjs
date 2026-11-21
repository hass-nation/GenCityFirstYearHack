import { copyFile, mkdir, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Pages is configured to serve main at the repository root.
const repository = fileURLToPath(new URL("../", import.meta.url));
const build = join(repository, "dist");

for (const directory of ["assets", "pets"]) {
  const source = join(build, directory);
  const target = join(repository, directory);
  const files = await readdir(source);
  await mkdir(target, { recursive: true });
  for (const filename of files) {
    await copyFile(join(source, filename), join(target, filename));
  }
  for (const entry of await readdir(target, { withFileTypes: true })) {
    if (entry.isFile() && !files.includes(entry.name)) {
      await unlink(join(target, entry.name));
    }
  }
}

await copyFile(join(build, "index.html"), join(repository, "index.html"));
