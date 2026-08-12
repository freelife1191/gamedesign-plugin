import { writeFileSync } from "node:fs";

const [pidPath, sentinel] = process.argv.slice(2);
if (!pidPath || !sentinel) process.exit(2);
process.title = sentinel;
writeFileSync(pidPath, `${process.pid}\n`, { flag: "wx" });
setInterval(() => {}, 1_000);
