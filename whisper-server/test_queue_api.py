#!/usr/bin/env python3
"""
Quick test script for the queue API endpoints
Tests the queue system functionality against a running server
"""

import requests
import time
import json
from pathlib import Path

# Configuration
BASE_URL = "http://192.168.1.26:8000"
TEST_AUDIO_FILE = "/tmp/test_audio.aiff"  # From our earlier test

def test_health():
    """Test basic health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health: {data['status']}, Model: {data['model_name']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_queue_endpoints():
    """Test if queue endpoints are available"""
    print("\n🔍 Testing queue endpoints availability...")
    
    endpoints = [
        "/queue/queue-stats",
        "/queue/active-jobs"
    ]
    
    available = 0
    for endpoint in endpoints:
        try:
            response = requests.get(f"{BASE_URL}{endpoint}")
            if response.status_code == 200:
                print(f"✅ {endpoint} - Available")
                available += 1
            else:
                print(f"❌ {endpoint} - Status: {response.status_code}")
        except Exception as e:
            print(f"❌ {endpoint} - Error: {e}")
    
    return available == len(endpoints)

def test_async_submission():
    """Test async job submission"""
    print("\n🔍 Testing async job submission...")
    
    if not Path(TEST_AUDIO_FILE).exists():
        print(f"❌ Test audio file not found: {TEST_AUDIO_FILE}")
        return False
    
    try:
        with open(TEST_AUDIO_FILE, 'rb') as f:
            files = {'audio_file': ('test.aiff', f, 'audio/aiff')}
            data = {
                'model': 'base',
                'expected_wpm': 100
            }
            
            response = requests.post(f"{BASE_URL}/queue/submit", files=files, data=data)
            
        if response.status_code == 200:
            result = response.json()
            job_id = result['job_id']
            print(f"✅ Job submitted: {job_id}")
            return job_id
        else:
            print(f"❌ Job submission failed: {response.status_code}")
            print(f"Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Job submission error: {e}")
        return None

def test_job_status(job_id):
    """Test job status checking"""
    print(f"\n🔍 Testing job status for: {job_id}")
    
    max_attempts = 10
    for attempt in range(max_attempts):
        try:
            response = requests.get(f"{BASE_URL}/queue/status/{job_id}")
            if response.status_code == 200:
                status = response.json()
                print(f"📊 Attempt {attempt + 1}: Status = {status['status']}")
                
                if status.get('progress'):
                    progress = status['progress']
                    print(f"   Progress: {progress.get('progress', 0)}% - {progress.get('status', 'Processing')}")
                
                if status['ready']:
                    if status['successful']:
                        result = status['result']
                        print(f"✅ Job completed successfully!")
                        print(f"   Text: {result.get('text', 'N/A')[:100]}...")
                        print(f"   WPM: {result.get('words_per_minute', 'N/A')}")
                        print(f"   Fluency: {result.get('fluency_score', 'N/A')}")
                        return True
                    else:
                        print(f"❌ Job failed: {status.get('error', 'Unknown error')}")
                        return False
                
                time.sleep(2)  # Wait before next check
            else:
                print(f"❌ Status check failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Status check error: {e}")
            return False
    
    print(f"⏰ Job did not complete within {max_attempts * 2} seconds")
    return False

def main():
    print("🧪 Queue System Test Suite")
    print("=" * 50)
    
    # Test 1: Basic health
    if not test_health():
        print("\n❌ Basic health check failed. Cannot proceed.")
        return
    
    # Test 2: Queue endpoints availability
    queue_available = test_queue_endpoints()
    
    if not queue_available:
        print("\n⚠️  Queue endpoints not available.")
        print("The server might not have the queue system deployed yet.")
        print("You can still test synchronous processing:")
        
        # Test synchronous endpoint as fallback
        print("\n🔍 Testing synchronous transcription...")
        try:
            with open(TEST_AUDIO_FILE, 'rb') as f:
                files = {'audio_file': ('test.aiff', f, 'audio/aiff')}
                response = requests.post(f"{BASE_URL}/transcribe", files=files)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ Sync transcription works!")
                print(f"   Text: {result.get('text', 'N/A')[:100]}...")
                print(f"   WPM: {result.get('words_per_minute', 'N/A')}")
            else:
                print(f"❌ Sync transcription failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Sync test error: {e}")
        
        return
    
    # Test 3: Async job submission and monitoring
    job_id = test_async_submission()
    if job_id:
        test_job_status(job_id)
    
    print("\n🏁 Test completed!")

if __name__ == "__main__":
    main()