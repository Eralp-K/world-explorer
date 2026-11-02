using System;
using System.Runtime.InteropServices;

// Windows Common Item Dialog. Uses the Explorer-style picker, not SHBrowseForFolder.
// Interface order follows shobjidl_core.h (IFileDialog inherits IModalWindow).
public static class ExplorerNativeDialog {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Filter {
        [MarshalAs(UnmanagedType.LPWStr)] public string Name;
        [MarshalAs(UnmanagedType.LPWStr)] public string Spec;
    }
    [ComImport, Guid("43826d1e-e718-42ee-bc55-a1e261c37bfe"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IShellItem {
        void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(uint kind, out IntPtr name);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem other, uint hint, out int order);
    }
    [ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IFileDialog {
        [PreserveSig] int Show(IntPtr owner);
        void SetFileTypes(uint count, [MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 0)] Filter[] filters);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint options);
        void GetOptions(out uint options);
        void SetDefaultFolder(IShellItem folder);
        void SetFolder(IShellItem folder);
        void GetFolder(out IShellItem folder);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult(out IShellItem result);
        void AddPlace(IShellItem place, uint position);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int result);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
    }
    public static void Probe() {
        object instance = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("dc1c5a9c-e88a-4dde-a5a1-60f82a20aef7")));
        try { uint options; ((IFileDialog)instance).GetOptions(out options); }
        finally { Marshal.FinalReleaseComObject(instance); }
    }
    public static string Pick(bool folder) {
        object instance = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("dc1c5a9c-e88a-4dde-a5a1-60f82a20aef7")));
        IShellItem item = null;
        try {
            var dialog = (IFileDialog)instance;
            uint options; dialog.GetOptions(out options);
            options |= 0x40u | 0x800u | 0x02000000u; // FORCEFILESYSTEM, PATHMUSTEXIST, DONTADDTORECENT
            options &= ~0x200u; // One world per selection; no multiselect.
            if (folder) options |= 0x20u; // PICKFOLDERS
            else {
                options |= 0x1000u; // FILEMUSTEXIST
                dialog.SetFileTypes(1, new[] { new Filter { Name = "Minecraft d\u00fcnya ar\u015fivi (*.zip)", Spec = "*.zip" } });
                dialog.SetDefaultExtension("zip");
            }
            dialog.SetOptions(options);
            dialog.SetTitle(folder ? "Minecraft d\u00fcnya klas\u00f6r\u00fcn\u00fc se\u00e7" : "Minecraft ZIP d\u00fcnyas\u0131n\u0131 se\u00e7");
            dialog.SetOkButtonLabel(folder ? "D\u00fcnyay\u0131 a\u00e7" : "ZIP'i a\u00e7");
            int result = dialog.Show(IntPtr.Zero);
            if (result == unchecked((int)0x800704C7)) return ""; // User cancelled.
            Marshal.ThrowExceptionForHR(result);
            dialog.GetResult(out item);
            IntPtr name; item.GetDisplayName(0x80058000u, out name); // SIGDN_FILESYSPATH
            try { return Marshal.PtrToStringUni(name); }
            finally { Marshal.FreeCoTaskMem(name); }
        } finally {
            if (item != null) Marshal.FinalReleaseComObject(item);
            Marshal.FinalReleaseComObject(instance);
        }
    }
}
