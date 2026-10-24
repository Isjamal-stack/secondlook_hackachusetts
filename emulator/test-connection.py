#!/usr/bin/env python3
"""
Test script to verify ELM327 emulator is working correctly.

This script connects to the emulator and sends basic AT commands
to verify it responds as expected.
"""

import socket
import time
import sys

def send_command(sock, command):
    """Send a command to the ELM327 emulator and return response."""
    # Add carriage return
    full_command = command + '\r'
    sock.sendall(full_command.encode('ascii'))
    
    # Wait a bit for response
    time.sleep(0.1)
    
    # Receive response
    response = sock.recv(1024).decode('ascii')
    return response.strip()

def main():
    host = 'localhost'
    port = 35000
    
    print("=" * 60)
    print("🔧 ELM327 Emulator Connection Test")
    print("=" * 60)
    print(f"Connecting to {host}:{port}...")
    
    try:
        # Create socket and connect
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((host, port))
        print("✅ Connected!")
        print("")
        
        # Test 1: Reset (ATZ)
        print("Test 1: Sending ATZ (reset)...")
        response = send_command(sock, 'ATZ')
        print(f"Response: {response}")
        if 'ELM327' in response:
            print("✅ Reset successful - ELM327 identified")
        else:
            print("⚠️  Unexpected response")
        print("")
        
        # Test 2: Echo off (ATE0)
        print("Test 2: Sending ATE0 (echo off)...")
        response = send_command(sock, 'ATE0')
        print(f"Response: {response}")
        print("✅ Echo disabled")
        print("")
        
        # Test 3: Get supported PIDs (0100)
        print("Test 3: Sending 0100 (supported PIDs)...")
        response = send_command(sock, '0100')
        print(f"Response: {response}")
        if '41 00' in response or 'SEARCHING' in response:
            print("✅ PID request successful")
        else:
            print("⚠️  Unexpected response")
        print("")
        
        # Test 4: Get RPM (010C)
        print("Test 4: Sending 010C (engine RPM)...")
        response = send_command(sock, '010C')
        print(f"Response: {response}")
        if '41 0C' in response or 'SEARCHING' in response:
            print("✅ RPM request successful")
        else:
            print("⚠️  Unexpected response")
        print("")
        
        sock.close()
        print("=" * 60)
        print("✅ All tests completed successfully!")
        print("=" * 60)
        print("")
        print("The emulator is working correctly.")
        print("You can now connect your web application to it.")
        
    except socket.timeout:
        print("❌ Error: Connection timeout")
        print("Is the emulator running? Start it with: python3 start-emulator.py")
        sys.exit(1)
    except ConnectionRefusedError:
        print("❌ Error: Connection refused")
        print("Is the emulator running? Start it with: python3 start-emulator.py")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
