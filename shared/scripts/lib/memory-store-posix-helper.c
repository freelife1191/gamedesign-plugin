/*
 * Capability boundary for design-memory namespace changes.  Node opens this
 * program with cwd set to the already identified store root; every pathname
 * below is resolved from a verified directory fd, never from an absolute
 * pathname supplied after that handshake.
 */
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

#ifdef __APPLE__
#include <sys/stdio.h>
#endif
#ifdef __linux__
#include <sys/syscall.h>
#include <linux/fs.h>
#endif

static void fail(const char *code) { fprintf(stderr, "%s\n", code); exit(70); }
static unsigned long long number(const char *value) { char *end = NULL; unsigned long long result = strtoull(value, &end, 10); if (!value[0] || *end) fail("memory.helper_argument"); return result; }
static int same_stat(const struct stat *value, const char *dev, const char *ino) { return (unsigned long long)value->st_dev == number(dev) && (unsigned long long)value->st_ino == number(ino); }
static int component_ok(const char *value) { return value && value[0] && strcmp(value, ".") && strcmp(value, "..") && !strchr(value, '/'); }
static int open_parent(int root, const char *relative) {
  int current = dup(root); if (current < 0) fail("memory.helper_open");
  char *copy = strdup(relative); if (!copy) fail("memory.helper_memory");
  if (!copy[0]) { free(copy); return current; }
  for (char *part = strtok(copy, "/"); part; part = strtok(NULL, "/")) {
    if (!component_ok(part)) fail("memory.helper_path");
    int next = openat(current, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW);
    if (next < 0) fail("memory.helper_parent");
    close(current); current = next;
  }
  free(copy); return current;
}
static void create_directory_tree(const char *root_dev, const char *root_ino, const char *relative) {
  int root = open(".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW), current; struct stat root_stat;
  if (root < 0 || fstat(root, &root_stat) || !same_stat(&root_stat, root_dev, root_ino)) fail("memory.helper_root_changed");
  current = dup(root); char *copy = strdup(relative); if (current < 0 || !copy) fail("memory.helper_memory");
  for (char *part = strtok(copy, "/"); part; part = strtok(NULL, "/")) {
    if (!component_ok(part)) fail("memory.helper_path");
    if (mkdirat(current, part, 0700) && errno != EEXIST) fail("memory.helper_mkdir");
    int next = openat(current, part, O_RDONLY | O_DIRECTORY | O_NOFOLLOW); if (next < 0) fail("memory.helper_parent");
    if (fsync(current)) fail("memory.helper_sync"); close(current); current = next;
  }
  if (fsync(current)) fail("memory.helper_sync"); close(current); close(root); free(copy);
}
static int root_and_parent(const char *root_dev, const char *root_ino, const char *relative, const char *parent_dev, const char *parent_ino) {
  int root = open(".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW); struct stat root_stat, parent_stat;
  if (root < 0 || fstat(root, &root_stat) || !same_stat(&root_stat, root_dev, root_ino)) fail("memory.helper_root_changed");
  int parent = open_parent(root, relative); close(root);
  if (fstat(parent, &parent_stat) || !same_stat(&parent_stat, parent_dev, parent_ino)) fail("memory.helper_parent_changed");
  return parent;
}
static void require_file_or_missing(int parent, const char *name, int allow_missing) {
  struct stat value;
  if (!component_ok(name)) fail("memory.helper_path");
  if (fstatat(parent, name, &value, AT_SYMLINK_NOFOLLOW) == 0) { if (!S_ISREG(value.st_mode)) fail("memory.helper_special_file"); return; }
  if (errno != ENOENT || !allow_missing) fail("memory.helper_target");
}
static void copy_stdin(int output, unsigned long long size) {
  char buffer[8192]; unsigned long long remaining = size;
  while (remaining) { size_t need = remaining < sizeof(buffer) ? (size_t)remaining : sizeof(buffer); ssize_t got = read(STDIN_FILENO, buffer, need); if (got <= 0) fail("memory.helper_input"); for (ssize_t at = 0; at < got;) { ssize_t wrote = write(output, buffer + at, (size_t)(got - at)); if (wrote <= 0) fail("memory.helper_write"); at += wrote; } remaining -= (unsigned long long)got; }
  if (read(STDIN_FILENO, buffer, 1) != 0) fail("memory.helper_input");
}
static int rename_no_replace(int source_parent, const char *source, int destination_parent, const char *destination) {
#ifdef __APPLE__
  return renameatx_np(source_parent, source, destination_parent, destination, RENAME_EXCL);
#elif defined(__linux__)
  return (int)syscall(SYS_renameat2, source_parent, source, destination_parent, destination, RENAME_NOREPLACE);
#else
  errno = ENOTSUP; return -1;
#endif
}
int main(int argc, char **argv) {
  if (argc < 2) fail("memory.helper_argument");
  if (!strcmp(argv[1], "mkdir")) {
    if (argc != 5) fail("memory.helper_argument");
    create_directory_tree(argv[2], argv[3], argv[4]); return 0;
  }
  if (!strcmp(argv[1], "write")) {
    if (argc != 13) fail("memory.helper_argument");
    int parent = root_and_parent(argv[2], argv[3], argv[4], argv[5], argv[6]);
    const char *mode = argv[7], *temporary = argv[8], *destination = argv[9];
    if (!component_ok(temporary) || !component_ok(destination) || (strcmp(mode, "create") && strcmp(mode, "replace-existing"))) fail("memory.helper_path");
    if (!strcmp(mode, "create")) {
      struct stat existing;
      if (fstatat(parent, destination, &existing, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) fail("memory.helper_exists");
    } else require_file_or_missing(parent, destination, 0);
    int tmp = openat(parent, temporary, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0600);
    if (tmp < 0) fail("memory.helper_temporary");
    copy_stdin(tmp, number(argv[10]));
    if (fsync(tmp) || close(tmp)) { unlinkat(parent, temporary, 0); fail("memory.helper_sync"); }
    if (!strcmp(mode, "replace-existing")) { struct stat current; if (fstatat(parent, destination, &current, AT_SYMLINK_NOFOLLOW) || !S_ISREG(current.st_mode) || !same_stat(&current, argv[11], argv[12])) { unlinkat(parent, temporary, 0); fail("memory.helper_target_changed"); } }
    int result = !strcmp(mode, "create") ? linkat(parent, temporary, parent, destination, 0) : renameat(parent, temporary, parent, destination);
    if (result) { unlinkat(parent, temporary, 0); fail(!strcmp(mode, "create") && errno == EEXIST ? "memory.helper_exists" : "memory.helper_publish"); }
    if (!strcmp(mode, "create") && unlinkat(parent, temporary, 0)) fail("memory.helper_cleanup");
    if (fsync(parent)) fail("memory.helper_sync"); close(parent); return 0;
  }
  if (!strcmp(argv[1], "move")) {
    if (argc != 12) fail("memory.helper_argument");
    int source_parent = root_and_parent(argv[2], argv[3], argv[4], argv[5], argv[6]);
    int destination_parent = root_and_parent(argv[2], argv[3], argv[7], argv[8], argv[9]);
    const char *source = argv[10], *destination = argv[11];
    require_file_or_missing(source_parent, source, 0); require_file_or_missing(destination_parent, destination, 1);
    if (faccessat(destination_parent, destination, F_OK, AT_SYMLINK_NOFOLLOW) == 0 || errno != ENOENT) fail("memory.helper_exists");
    if (rename_no_replace(source_parent, source, destination_parent, destination)) fail(errno == EEXIST ? "memory.helper_exists" : "memory.helper_publish");
    if (fsync(source_parent) || (source_parent != destination_parent && fsync(destination_parent))) fail("memory.helper_sync");
    close(source_parent); close(destination_parent); return 0;
  }
  fail("memory.helper_argument");
}
