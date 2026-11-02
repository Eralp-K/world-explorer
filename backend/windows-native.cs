using System;
using System.Text;
using System.IO;

public static class WorldExplorerNative {
    [STAThread]
    public static int Main(string[] args) {
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
        Console.SetError(new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false)) { AutoFlush = true });
        try {
            if (args.Length == 1 && args[0] == "probe") {
                ExplorerNativeDialog.Probe(); Console.Write("Windows Common Item Dialog ready"); return 0;
            }
            if (args.Length == 1 && (args[0] == "folder" || args[0] == "zip")) {
                Console.Write(ExplorerNativeDialog.Pick(args[0] == "folder")); return 0;
            }
            if (args.Length == 3 && args[0] == "extract") {
                ExplorerWorldZip.Extract(args[1], args[2]); Console.Write("OK"); return 0;
            }
            throw new ArgumentException("Unknown native helper operation.");
        } catch (Exception e) { Console.Error.Write(e.GetBaseException().Message); return 1; }
    }
}
