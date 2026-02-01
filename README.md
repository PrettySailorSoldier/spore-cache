# 🌱 Spore Cache

> **Capture quick tasks before your brain drops them.**

A minimalist Chrome extension for managing micro-tasks with a unique Tamagotchi-inspired aesthetic. Spore Cache helps you quickly jot down fleeting thoughts and tasks without breaking your flow.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

---

## ✨ Features

### 📝 **Rich Text Editing**
- **Contenteditable document** with inline formatting
- **Bold** (`Ctrl+B`) and *Italic* (`Ctrl+I`) text styling
- **Bullet points** created with the Tab key
- Clean, distraction-free interface

### ✅ **Interactive Checkboxes**
- Hover over any line to reveal a checkbox
- Click to mark tasks as complete
- Completed tasks persist across sessions

### 🎨 **Retro Aesthetic**
- Tamagotchi-inspired pixel art decorations
- Warm, nostalgic color palette
- Playful UI elements that make task management fun

### 🔔 **Smart Badge Counter**
- Extension icon displays count of incomplete tasks
- Updates in real-time as you check off items
- Persists across browser sessions

### 🧹 **Auto-Cleanup**
- Automatically removes completed tasks after 24 hours
- Keeps your list fresh and focused
- Runs silently in the background

### ⌨️ **Keyboard Shortcut**
- Quick access with `Ctrl+Shift+M` (Windows/Linux)
- `Cmd+Shift+M` on Mac
- Customizable in Chrome's extension settings

---

## 🚀 Installation

### From Source

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/PrettySailorSoldier/spore-cache.git
   ```

2. **Open Chrome and navigate to:**
   ```
   chrome://extensions/
   ```

3. **Enable "Developer mode"** (toggle in top-right corner)

4. **Click "Load unpacked"** and select the `spore-cache` folder

5. **Done!** The extension icon should appear in your toolbar

### Pinning the Extension
- Click the puzzle piece icon in Chrome's toolbar
- Find "Spore Cache" and click the pin icon
- Now it's always visible for quick access

---

## 🎯 Usage

### Adding Tasks
1. Click the extension icon or press `Ctrl+Shift+M`
2. Type your task in the editor
3. Use **Tab** to create bullet points
4. Format text with `Ctrl+B` (bold) or `Ctrl+I` (italic)

### Completing Tasks
1. Hover over any line to reveal the checkbox
2. Click the checkbox to mark as complete
3. Completed tasks will auto-delete after 24 hours

### Viewing Task Count
- The extension icon badge shows your incomplete task count
- Updates automatically as you add/complete tasks

---

## 🛠️ Technical Details

### Permissions
- **`storage`** - Saves your tasks and completion status locally
- **`alarms`** - Schedules automatic cleanup of old completed tasks

### Storage Schema
```javascript
{
  "documentHTML": "<p>Your tasks here...</p>",
  "completedTasks": {
    "task-id-1": 1738419600000,  // timestamp
    "task-id-2": 1738506000000
  }
}
```

### Files
- `manifest.json` - Extension configuration
- `popup.html` - Main UI structure
- `popup.css` - Styling and animations
- `popup.js` - Task management logic
- `background.js` - Badge updates and auto-cleanup
- `assets/` - Decorative illustrations
- `icons/` - Extension icons

---

## 🎨 Customization

### Changing the Keyboard Shortcut
1. Go to `chrome://extensions/shortcuts`
2. Find "Spore Cache"
3. Click the pencil icon and set your preferred shortcut

### Modifying Auto-Cleanup Duration
Edit `background.js` and change the `CLEANUP_INTERVAL`:
```javascript
const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
```

---

## 🐛 Known Issues

- None currently! Report issues on the [GitHub Issues page](https://github.com/PrettySailorSoldier/spore-cache/issues)

---

## 📜 License

This project is open source and available under the [MIT License](LICENSE).

---

## 💖 Credits

Created with ✨ by [PrettySailorSoldier](https://github.com/PrettySailorSoldier)

Inspired by the nostalgia of Tamagotchi and the need for frictionless task capture.

---

## 🌟 Support

If you find Spore Cache helpful, consider:
- ⭐ Starring this repository
- 🐛 Reporting bugs or suggesting features
- 🔀 Contributing improvements via pull requests

---

**Happy task wrangling! 🌱✨**
