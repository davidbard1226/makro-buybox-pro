Set objShell = CreateObject("WScript.Shell")

' ── ADD info@onlinetechhub.co.za ──────────────────────────────────
' Open Outlook Settings via keyboard shortcut
objShell.AppActivate "Outlook"
WScript.Sleep 1000

' Press Ctrl+Shift+A to open Add Account (works in some versions)
' Or navigate via File menu
objShell.SendKeys "^,"  ' Ctrl+, opens Settings in new Outlook
WScript.Sleep 2000

MsgBox "Outlook Settings should be open." & vbCrLf & vbCrLf & _
    "ACCOUNT 1 - info@onlinetechhub.co.za" & vbCrLf & _
    "Click 'Add account' or 'Add an email account'" & vbCrLf & vbCrLf & _
    "Click OK when ready to see the settings to enter.", _
    vbInformation, "Online TechHub Email Setup - Step 1"
