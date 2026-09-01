Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\David\OpenWork Chat\makro-buybox-pro"
WshShell.Run "node server.js", 0, False
