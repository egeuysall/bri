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
	version     = "1.0.0"
	userAgent   = "bridge-cli/" + version
	apiEndpoint = "https://bridgeapi.egeuysal.com:9443/v1/posts"
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

	// Validate file exists
	if _, err := os.Stat(*filePath); os.IsNotExist(err) {
		fmt.Printf("\u2717 Error: File '%s' does not exist\n", *filePath)
		os.Exit(1)
	}

	// Start timing
	start := time.Now()

	// Read the Markdown file
	mdData, err := os.ReadFile(*filePath)
	if err != nil {
		fmt.Printf("\u2717 Error reading file: %v\n", err)
		os.Exit(1)
	}

	// Validate content
	if len(strings.TrimSpace(string(mdData))) == 0 {
		fmt.Printf("\u2717 Error: File is empty or contains only whitespace\n")
		os.Exit(1)
	}

	// Generate slug from filename
	slug := utils.GenerateSlug(*filePath, string(mdData))

	// Wrap it in a JSON payload with slug
	payload := []byte(fmt.Sprintf(`{"content": %q, "slug": %q}`, string(mdData), slug))

	// Create request
	req, err := http.NewRequest("POST", apiEndpoint, bytes.NewBuffer(payload))
	if err != nil {
		fmt.Printf("\u2717 Error creating request: %v\n", err)
		os.Exit(1)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)

	// Configure client
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

	// Accept 200 and 201 as success
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		fmt.Printf("\u2717 Server returned status %d: %s\n", resp.StatusCode, string(body))
		os.Exit(1)
	}

	// Parse the slug from the response
	type RespData struct {
		Data struct {
			Slug string `json:"slug"`
		} `json:"data"`
	}

	var result RespData
	if err := json.Unmarshal(body, &result); err != nil {
		fmt.Printf("\u2717 Error parsing response JSON: %v\n", err)
		os.Exit(1)
	}

	// Calculate duration
	duration := time.Since(start)
	url := fmt.Sprintf("https://bridge.egeuysal.com/%s", result.Data.Slug)

	// Display success message
	fmt.Printf("\u2713 Published in \x1b[31m%dms\x1b[0m\n\u2192 \x1b[34m%s\x1b[0m\n", duration.Milliseconds(), url)

	// Copy to clipboard unless disabled
	if !*noCopy {
		if err := copyToClipboard(url); err != nil {
			fmt.Printf("\u26a0 Warning: Could not copy to clipboard: %v\n", err)
		}
	}

	// Open browser
	if err := openBrowser(url); err != nil {
		fmt.Printf("\u26a0 Warning: Could not open browser: %v\n", err)
	}
}
