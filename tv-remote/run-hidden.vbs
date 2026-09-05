Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("Wscript.Shell")
sh.Run """C:\Program Files\nodejs\node.exe"" """ & dir & "\server.js""", 0, False
