for await (const _chunk of process.stdin) {
  // Consume the normal one-line request before exercising the parent seam.
}

if (process.env.DESIGN_MEMORY_CHILD_OUTPUT_SEAM === "extra-blank") process.stdout.write('{}\n\n');
else if (process.env.DESIGN_MEMORY_CHILD_OUTPUT_SEAM === "oversized") process.stdout.write("x".repeat(128 * 1024));
else process.stdout.write('{}\n');
