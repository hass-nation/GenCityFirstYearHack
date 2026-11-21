"""Run the Windows desktop pet with python -m desktop.pet_overlay."""

import ctypes
from ctypes import wintypes
import json
from pathlib import Path
from queue import Empty, Queue
import sys
from threading import Event, Thread
from time import monotonic, time
import tkinter as tk
from urllib.request import urlopen

SPRITES = Path(__file__).resolve().parent.parent / "public" / "pets"
ENDPOINT = "http://127.0.0.1:5000/api/desktop-pet"
TRANSPARENT = "#ff00ff"
SIZE = 96


def work_area():
    rect = wintypes.RECT()
    ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
    return rect.left, rect.top, rect.right, rect.bottom


def poll_desktop(updates, stopped):
    while not stopped.is_set():
        try:
            with urlopen(ENDPOINT, timeout=1.5) as response:
                data = json.loads(response.read(60_000))
            updates.put(data)
        except (OSError, ValueError):
            pass
        stopped.wait(0.6)


class DesktopPet:
    def __init__(self, root):
        self.root = root
        self.appearance = {"name": "Wobbles", "species": "camel"}
        self.frames = self.load_frames(self.appearance)
        self.direction = -1
        left, _, right, bottom = work_area()
        self.x, self.y = max(left, right - SIZE - 32), bottom - SIZE
        self.walking = True
        self.drag = None
        self.last_tick = monotonic()
        self.last_speech = None
        self.speech_deadline = 0
        self.stopped = Event()
        self.updates = Queue()

        root.title("PC Pet")
        root.overrideredirect(True)
        root.attributes("-topmost", True)
        root.attributes("-transparentcolor", TRANSPARENT)
        self.sprite = tk.Label(root, bg=TRANSPARENT, borderwidth=0, highlightthickness=0)
        self.sprite.pack(fill="both", expand=True)
        self.sprite.bind("<ButtonPress-1>", self.begin_drag)
        self.sprite.bind("<B1-Motion>", self.move_drag)
        self.sprite.bind("<ButtonRelease-1>", self.end_drag)
        self.sprite.bind("<Button-3>", self.show_menu)
        root.protocol("WM_DELETE_WINDOW", self.close)

        self.bubble = tk.Toplevel(root)
        self.bubble.withdraw()
        self.bubble.overrideredirect(True)
        self.bubble.attributes("-topmost", True)
        self.bubble.attributes("-transparentcolor", TRANSPARENT)
        self.bubble_canvas = tk.Canvas(self.bubble, bg=TRANSPARENT, highlightthickness=0)
        self.bubble_canvas.pack()
        self.speech = tk.Label(self.bubble_canvas, bg="#eaf6ff", fg="#142943", wraplength=226,
                               justify="left", padx=10, pady=7, font=("Segoe UI", 10))
        self.bubble_canvas.create_window(0, 0, window=self.speech, anchor="nw")
        self.tail = self.bubble_canvas.create_polygon(0, 0, 0, 0, 0, 0, fill="#eaf6ff")

        self.menu = tk.Menu(root, tearoff=False)
        self.menu.add_command(label="Pause walking", command=self.toggle_walk)
        self.menu.add_command(label="Quit desktop pet", command=self.close)
        root.geometry(f"{SIZE}x{SIZE}+{self.x}+{self.y}")
        self.say("Hi! I’m Wobbles.")
        self.tick()
        Thread(target=poll_desktop, args=(self.updates, self.stopped), daemon=True).start()

    def load_frames(self, appearance):
        if appearance["species"] == "custom":
            images = [tk.PhotoImage(data=frame.split(",", 1)[1], master=self.root)
                      for frame in appearance["frames"]]
        else:
            species = appearance["species"]
            images = [tk.PhotoImage(file=SPRITES / f"{species}-{index}.png", master=self.root)
                      for index in (1, 2)]
        frames = [image.zoom(3) if image.width() <= 32 else image for image in images]
        flipped = []
        for frame in frames:
            mirror = tk.PhotoImage(width=frame.width(), height=frame.height(), master=self.root)
            for column in range(frame.width()):
                mirror.tk.call(mirror, "copy", frame, "-from", column, 0, column + 1, frame.height(),
                               "-to", frame.width() - column - 1, 0)
            flipped.append(mirror)
        return frames, flipped

    def say(self, text, duration=8):
        self.speech.configure(text=text)
        width, height = self.speech.winfo_reqwidth(), self.speech.winfo_reqheight()
        self.bubble_canvas.configure(width=width, height=height + 8)
        center = width // 2
        self.bubble_canvas.coords(self.tail, center - 7, height, center + 7, height, center, height + 8)
        self.speech_deadline = monotonic() + duration
        self.position_bubble()
        self.bubble.deiconify()

    def position_bubble(self):
        left, top, right, _ = work_area()
        width, height = self.speech.winfo_reqwidth(), self.speech.winfo_reqheight() + 8
        x = max(left, min(right - width, int(self.x + (SIZE - width) / 2)))
        y = max(top, self.y - height)
        self.bubble.geometry(f"{width}x{height}+{x}+{y}")

    def apply_update(self, update):
        appearance = update.get("appearance")
        if appearance and appearance != self.appearance:
            try:
                self.frames = self.load_frames(appearance)
            except (tk.TclError, KeyError, ValueError, TypeError):
                pass
            self.appearance = appearance
        speech = update.get("speech")
        if speech and speech["id"] != self.last_speech:
            self.last_speech = speech["id"]
            if (remaining := speech["expires"] - time()) > 0:
                self.say(speech["text"], remaining)

    def tick(self):
        try:
            while True:
                self.apply_update(self.updates.get_nowait())
        except Empty:
            pass
        now = monotonic()
        if self.walking and self.drag is None:
            left, top, right, bottom = work_area()
            self.x += self.direction * 44 * min(now - self.last_tick, 0.1)
            if self.x <= left or self.x >= right - SIZE:
                self.direction = 1 if self.x <= left else -1
                self.x = max(left, min(right - SIZE, self.x))
            self.y = max(top, min(bottom - SIZE, self.y))
        self.last_tick = now
        frame = int(now / 0.3) % 2 if self.walking and self.drag is None else 0
        self.sprite.configure(image=self.frames[self.direction > 0][frame])
        self.root.geometry(f"{SIZE}x{SIZE}+{int(self.x)}+{self.y}")
        if now < self.speech_deadline:
            self.position_bubble()
        elif self.bubble.state() != "withdrawn":
            self.bubble.withdraw()
        self.root.after(40, self.tick)

    def begin_drag(self, event):
        self.drag = event.x_root - self.x, event.y_root - self.y

    def move_drag(self, event):
        if self.drag is not None:
            left, top, right, bottom = work_area()
            self.x = max(left, min(right - SIZE, event.x_root - self.drag[0]))
            self.y = int(max(top, min(bottom - SIZE, event.y_root - self.drag[1])))

    def end_drag(self, _event):
        self.drag = None

    def show_menu(self, event):
        self.menu.tk_popup(event.x_root, event.y_root)

    def toggle_walk(self):
        self.walking = not self.walking
        self.menu.entryconfigure(0, label="Pause walking" if self.walking else "Resume walking")

    def close(self):
        self.stopped.set()
        self.root.destroy()


def main():
    if sys.platform != "win32":
        raise SystemExit("The walking desktop companion requires Windows.")
    root = tk.Tk()
    DesktopPet(root)
    root.mainloop()


if __name__ == "__main__":
    main()
