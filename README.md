# Bridge

Bridge is a minimalist tool to share your Markdown files instantly.  
Convert any `.md` file into a clean, shareable link with zero hassle.

## Features

- Easy Markdown sharing
- Instant web previews
- Simple, fast workflow

## Installation

Install Bridge using Go:

```bash
go install github.com/egeuysall/bridge/backend/cmd/bridge@master
```

## Usage

To share a Markdown file, simply run:

```bash
bridge -p filename.md
```

This will automatically push your file to the internet and return a link that you can open or share.

### CLI Options

```
USAGE:
    bridge [OPTIONS]

OPTIONS:
    -p <path>        Path to Markdown file (required)
    -h, --help       Show this help message
    --version        Show version information
    --no-copy        Don't copy URL to clipboard

EXAMPLES:
    bridge -p post.md
    bridge -p ./docs/tutorial.md --no-copy
```

### Aliases

```
alias b='bridge -p'
```

### Features

- **Automatic slug generation**: Creates clean URLs based on filename and content
- **Browser auto-open**: Automatically opens the published link in your browser
- **Clipboard copy**: Copies the URL to your clipboard (can be disabled with `--no-copy`)
- **Performance tracking**: Shows upload time in milliseconds
- **Cross-platform**: Works on macOS, Linux, and Windows

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.
