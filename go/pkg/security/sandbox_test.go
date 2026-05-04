package security

import (
	"testing"
)

func TestIsDestructiveCommand(t *testing.T) {
	dangerousCmds := []string{
		"rm -rf /",
		"rm -rf *",
		"mkfs.ext4 /dev/sda1",
		"dd if=/dev/zero of=/dev/sda",
		"echo `rm -rf /`",
		"echo $(rm -rf /)",
		":(){ :|:& };:",
	}

	for _, cmd := range dangerousCmds {
		if !IsDestructiveCommand(cmd) {
			t.Errorf("Expected %q to be identified as destructive, but it was not", cmd)
		}
	}

	safeCmds := []string{
		"ls -la",
		"echo 'hello'",
		"rm -rf ./tmp",
	}

	for _, cmd := range safeCmds {
		if IsDestructiveCommand(cmd) {
			t.Errorf("Expected %q to be identified as safe, but it was not", cmd)
		}
	}
}

func TestStripCommandWrappers(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"sudo ls", "ls"},
		{"timeout 10 ls", "ls"},
		{"timeout -s 9 10s ls", "ls"},
		{"watch -n 1 ls", "ls"},
		{"sudo timeout 10 watch ls", "ls"},
		{"ls", "ls"},
	}

	for _, test := range tests {
		result := StripCommandWrappers(test.input)
		if result != test.expected {
			t.Errorf("StripCommandWrappers(%q) = %q, expected %q", test.input, result, test.expected)
		}
	}
}
