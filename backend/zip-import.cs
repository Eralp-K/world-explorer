using System;
using System.IO;
using System.IO.Compression;
using System.Collections.Generic;

// Streaming ZIP/ZIP64 import. Only the selected world's subtree is extracted.
// The archive is read-only; files are created exclusively under a fresh cache directory.
public static class ExplorerWorldZip {
    static string Name(string value) {
        string n = value.Replace('\\', '/');
        if (n.StartsWith("/") || n.IndexOf(':') >= 0 || n.IndexOf('\0') >= 0)
            throw new InvalidDataException("ZIP contains an unsafe absolute path.");
        foreach (string segment in n.Split('/')) {
            if (segment == ".." || segment == "." || segment.EndsWith(".") || segment.EndsWith(" "))
                throw new InvalidDataException("ZIP contains an unsafe relative path.");
            if (segment.Length > 0) {
                string stem = segment.Split('.')[0].ToUpperInvariant();
                if (stem == "CON" || stem == "PRN" || stem == "AUX" || stem == "NUL" ||
                    (stem.Length == 4 && (stem.StartsWith("COM") || stem.StartsWith("LPT")) && stem[3] >= '0' && stem[3] <= '9'))
                    throw new InvalidDataException("ZIP contains a reserved Windows filename.");
            }
        }
        return n;
    }
    public static void Extract(string archive, string destination) {
        string root = Path.GetFullPath(destination).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (Directory.Exists(root) && Directory.GetFileSystemEntries(root).Length != 0)
            throw new IOException("Import destination must be empty.");
        using (var file = new FileStream(archive, FileMode.Open, FileAccess.Read, FileShare.Read))
        using (var zip = new ZipArchive(file, ZipArchiveMode.Read)) {
            if (zip.Entries.Count > 500000) throw new InvalidDataException("ZIP has too many files.");
            string prefix = null;
            // Validate every path before creating files. Reject ambiguous multi-world archives.
            foreach (var entry in zip.Entries) {
                string n = Name(entry.FullName);
                if (n.StartsWith("__MACOSX/", StringComparison.Ordinal)) continue;
                if (n == "level.dat" || n.EndsWith("/level.dat", StringComparison.Ordinal)) {
                    if (prefix != null) throw new InvalidDataException("ZIP contains more than one world. Select an archive containing one world.");
                    prefix = n.Substring(0, n.Length - "level.dat".Length);
                }
            }
            if (prefix == null) throw new InvalidDataException("ZIP contains no level.dat. Select a Minecraft Java world archive.");
            long total = 0;
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var entry in zip.Entries) {
                string n = Name(entry.FullName);
                if (!n.StartsWith(prefix, StringComparison.Ordinal) || n.StartsWith("__MACOSX/", StringComparison.Ordinal)) continue;
                string relative = n.Substring(prefix.Length);
                if (relative.Length == 0) continue;
                string target = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
                if (!target.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("ZIP path leaves the import directory.");
                if (((entry.ExternalAttributes >> 16) & 0xF000) == 0xA000) throw new InvalidDataException("ZIP symbolic links are not supported.");
                if (relative.EndsWith("/", StringComparison.Ordinal)) continue;
                if (!names.Add(target)) throw new InvalidDataException("ZIP contains duplicate file paths.");
                total = checked(total + entry.Length);
                if (entry.Length > 8L * 1024 * 1024 * 1024 || total > 64L * 1024 * 1024 * 1024)
                    throw new InvalidDataException("ZIP exceeds the 64 GiB world import limit.");
            }
            Directory.CreateDirectory(root);
            byte[] buffer = new byte[1024 * 1024];
            foreach (var entry in zip.Entries) {
                string n = Name(entry.FullName);
                if (!n.StartsWith(prefix, StringComparison.Ordinal) || n.StartsWith("__MACOSX/", StringComparison.Ordinal)) continue;
                string relative = n.Substring(prefix.Length);
                if (relative.Length == 0 || relative.EndsWith("/", StringComparison.Ordinal)) continue;
                string target = Path.GetFullPath(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
                Directory.CreateDirectory(Path.GetDirectoryName(target));
                using (var input = entry.Open())
                using (var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None)) {
                    long written = 0; int count;
                    while ((count = input.Read(buffer, 0, buffer.Length)) > 0) {
                        written += count;
                        if (written > entry.Length) throw new InvalidDataException("ZIP entry exceeds its declared size.");
                        output.Write(buffer, 0, count);
                    }
                    if (written != entry.Length) throw new InvalidDataException("ZIP entry is truncated.");
                }
                // Preserve player save times so the newest player is not determined by extraction order.
                try { File.SetLastWriteTimeUtc(target, entry.LastWriteTime.UtcDateTime); }
                catch (ArgumentOutOfRangeException) { }
            }
        }
    }
}
