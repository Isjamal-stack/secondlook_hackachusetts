#!/usr/bin/env python3
"""
ELM327 Emulator Startup Script

This script starts the ELM327 emulator for development and testing.
It simulates a Toyota Auris Hybrid vehicle connected via OBD-II.

Default configuration:
- TCP/IP connection on port 35000
- Scenario: car (Toyota Auris Hybrid)
- Protocol: Auto-detect (supports CAN, ISO, KWP)
"""

import sys
import subprocess
import argparse

def main():
    parser = argparse.ArgumentParser(
        description='Start ELM327 emulator for vehicle diagnostics testing'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=35000,
        help='TCP port to listen on (default: 35000)'
    )
    parser.add_argument(
        '--scenario',
        type=str,
        default='car',
        help='Vehicle scenario to emulate (default: car - Toyota Auris Hybrid)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🚗 ELM327 Emulator Starting")
    print("=" * 60)
    print(f"Port:     {args.port}")
    print(f"Scenario: {args.scenario}")
    print(f"Protocol: Auto-detect (CAN/ISO/KWP)")
    print("")
    print("The emulator simulates a Toyota Auris Hybrid vehicle.")
    print("Connect your application to localhost:{} to begin testing.".format(args.port))
    print("")
    print("Common test commands:")
    print("  ATZ        - Reset ELM327")
    print("  ATSP0      - Set protocol to auto")
    print("  0100       - Get supported PIDs")
    print("  010C       - Get engine RPM")
    print("  010D       - Get vehicle speed")
    print("")
    print("Press Ctrl+C to stop the emulator")
    print("=" * 60)
    print("")
    
    # Build command
    cmd = [
        'elm',
        '-n',  # TCP/IP mode
        '-p', str(args.port),
        '-s', args.scenario
    ]
    
    if args.verbose:
        cmd.append('-v')
    
    try:
        # Start the emulator
        subprocess.run(cmd)
    except KeyboardInterrupt:
        print("\n\n✅ Emulator stopped")
        sys.exit(0)
    except FileNotFoundError:
        print("\n❌ Error: ELM327-emulator not installed")
        print("\nPlease run: python3 -m pip install ELM327-emulator")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Error starting emulator: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
