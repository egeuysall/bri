package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/egeuysall/bridge/backend/internal/utils"
)

const (
	version     = "1.2.3"
	userAgent   = "bridge-cli/" + version
	apiEndpoint = "https://bridge.egeuysal.com/api/posts"
	siteURL     = "https://bridge.egeuysal.com"
)

func showHelp() {
	fmt.Printf(`bridge-cli v%s

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

`, version)
}

func copyToClipboard(text string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("pbcopy")
	case "linux":
		if _, err := exec.LookPath("xclip"); err == nil {
			cmd = exec.Command("xclip", "-selection", "clipboard")
		} else if _, err := exec.LookPath("xsel"); err == nil {
			cmd = exec.Command("xsel", "--clipboard", "--input")
		} else {
			return fmt.Errorf("no clipboard utility found (install xclip or xsel)")
		}
	case "windows":
		cmd = exec.Command("cmd", "/c", "echo", text, "|", "clip")
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	cmd.Stdin = strings.NewReader(text)
	return cmd.Run()
}

func openBrowser(url string) error {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "linux":
		cmd = exec.Command("xdg-open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		return fmt.Errorf("unsupported platform: %s", runtime.GOOS)
	}

	return cmd.Start()
}

func main() {
	var (
		filePath = flag.String("p", "", "Path to Markdown file")
		help     = flag.Bool("h", false, "Show help")
		showVer  = flag.Bool("version", false, "Show version")
		noCopy   = flag.Bool("no-copy", false, "Don't copy URL to clipboard")
	)

	flag.Usage = showHelp
	flag.Parse()

	if *help {
		showHelp()
		return
	}

	if *showVer {
		fmt.Printf("bridge-cli v%s\n", version)
		return
	}

	if *filePath == "" {
		fmt.Printf("\u2717 Error: Please provide a file path using -p flag\n\n")
		flag.Usage()
		os.Exit(1)
	}

	if _, err := os.Stat(*filePath); os.IsNotExist(err) {
		fmt.Printf("\u2717 Error: File '%s' does not exist\n", *filePath)
		os.Exit(1)
	}

	start := time.Now()

	mdData, err := os.ReadFile(*filePath)
	if err != nil {
		fmt.Printf("\u2717 Error reading file: %v\n", err)
		os.Exit(1)
	}

	if len(strings.TrimSpace(string(mdData))) == 0 {
		fmt.Printf("\u2717 Error: File is empty or contains only whitespace\n")
		os.Exit(1)
	}

	slug := utils.GenerateSlug(*filePath, string(mdData))
	payload := []byte(fmt.Sprintf(`{"content": %q, "slug": %q}`, string(mdData), slug))

	req, err := http.NewRequest(http.MethodPost, apiEndpoint, bytes.NewBuffer(payload))
	if err != nil {
		fmt.Printf("\u2717 Error creating request: %v\n", err)
		os.Exit(1)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("\u2717 Error sending request: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("\u2717 Error reading response: %v\n", err)
		os.Exit(1)
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		fmt.Printf("\u2717 Server returned status %d: %s\n", resp.StatusCode, string(body))
		os.Exit(1)
	}

	type respData struct {
		Data struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}

	var result respData
	if err := json.Unmarshal(body, &result); err != nil {
		fmt.Printf("\u2717 Error parsing response JSON: %v\n", err)
		os.Exit(1)
	}

	if result.Data.Slug == "" {
		fmt.Printf("\u2717 Error: Response did not include a slug\n")
		os.Exit(1)
	}

	duration := time.Since(start)
	url := fmt.Sprintf("%s/%s", siteURL, result.Data.Slug)

	fmt.Printf("\u2713 Published in \x1b[31m%dms\x1b[0m\n\u2192 \x1b[34m%s\x1b[0m\n", duration.Milliseconds(), url)

	if !*noCopy {
		if err := copyToClipboard(url); err != nil {
			fmt.Printf("\u26a0 Warning: Could not copy to clipboard: %v\n", err)
		}
	}

	if err := openBrowser(url); err != nil {
		fmt.Printf("\u26a0 Warning: Could not open browser: %v\n", err)
	}
}
