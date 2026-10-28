LEDGERLY - PERSONAL EXPENSE TRACKER
===================================

Ledgerly runs entirely on your computer. Nothing is uploaded anywhere:
your expenses are saved in your web browser.


REQUIREMENTS

Python 3.7 or newer. Almost every Linux distribution already has it.
To check, run:   python3 --version

If it's missing, install it with your package manager:
  Debian, Ubuntu, Mint:   sudo apt install python3
  Fedora:                 sudo dnf install python3
  Arch:                   sudo pacman -S python

(Node.js works too if you have that instead.)


START IT

1. Extract the download:
     tar -xzf ledgerly-linux.tar.gz

2. Run the launcher:
     cd ledgerly
     ./start.sh

Ledgerly opens in your browser at http://127.0.0.1:8765/
Keep the terminal window open while you use it. Press Ctrl+C there to stop.

If your file manager asks what to do with start.sh, choose "Run in Terminal".
If you get "Permission denied", run it as:   bash start.sh


ADD IT TO YOUR APPLICATIONS MENU (OPTIONAL)

     ./start.sh --install-shortcut

Run that again if you move the folder.


TRY IT OUT

- On the empty dashboard, click "Load sample data" to fill it with
  six months of example expenses, or click "Add expense".
- The Expenses page lets you search, filter by category or date,
  sort, edit, delete (with undo), and export to CSV.


GOOD TO KNOW

- Your data is tied to the browser and the address. Use the same browser
  and keep the default port to see the same expenses next time.
- Clearing your browser's site data for 127.0.0.1 deletes your expenses.
  Use "Export CSV" if you want a backup.
- Port 8765 already taken by something else? Use another one:
     LEDGERLY_PORT=8766 ./start.sh
