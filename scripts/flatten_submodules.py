import os
import re
import urllib.request
import zipfile
import shutil
import time
import sys

# Reconfigure stdout to support UTF-8 path names in Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

gitmodules_path = os.path.join(project_root, ".gitmodules")

def parse_gitmodules(path):
    if not os.path.exists(path):
        print(f"No .gitmodules file found at {path}")
        return []
    
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    submodules = []
    blocks = re.findall(r'\[submodule "([^"]+)"\](.*?)(?=\[submodule|\Z)', content, re.DOTALL)
    for name, block_content in blocks:
        path_match = re.search(r'path\s*=\s*(.*)', block_content)
        url_match = re.search(r'url\s*=\s*(.*)', block_content)
        if path_match and url_match:
            submodules.append({
                "name": name,
                "path": path_match.group(1).strip(),
                "url": url_match.group(1).strip()
            })
    return submodules

def download_and_extract_submodule(submodule):
    name = submodule["name"]
    target_rel_path = submodule["path"]
    repo_url = submodule["url"]
    
    target_abs_path = os.path.join(project_root, target_rel_path.replace('/', os.sep).replace('\\', os.sep))
    
    print(f"Processing submodule '{name}' -> target: {target_abs_path}")
    
    # Clean target directory if exists
    if os.path.exists(target_abs_path):
        print(f"Cleaning existing directory: {target_abs_path}")
        try:
            shutil.rmtree(target_abs_path)
        except Exception as e:
            print(f"Warning: could not clean folder {target_abs_path}: {e}")
            
    os.makedirs(target_abs_path, exist_ok=True)
    
    # Extract owner and repo from url
    # e.g., https://github.com/browser-use/browser-use.git
    clean_url = repo_url
    if clean_url.endswith(".git"):
        clean_url = clean_url[:-4]
    
    parts = clean_url.split("/")
    if len(parts) < 5:
        print(f"Error: Invalid Github URL structure for {repo_url}")
        return False
        
    owner = parts[-2]
    repo = parts[-1]
    
    # Try downloading HEAD archive first (default branch)
    temp_zip = os.path.join(project_root, f"{repo}_temp.zip")
    temp_extract = os.path.join(project_root, f"{repo}_temp_extract")
    
    download_success = False
    urls_to_try = [
        f"https://github.com/{owner}/{repo}/archive/HEAD.zip",
        f"https://github.com/{owner}/{repo}/archive/refs/heads/main.zip",
        f"https://github.com/{owner}/{repo}/archive/refs/heads/master.zip"
    ]
    
    for zip_url in urls_to_try:
        print(f"Downloading from: {zip_url} ...")
        try:
            req = urllib.request.Request(
                zip_url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req, timeout=30) as response, open(temp_zip, 'wb') as out_file:
                shutil.copyfileobj(response, out_file)
            print("Download successful.")
            download_success = True
            break
        except Exception as e:
            print(f"Failed download from {zip_url}: {e}")
            if os.path.exists(temp_zip):
                try:
                    os.remove(temp_zip)
                except:
                    pass
            time.sleep(1)
            
    if not download_success:
        print(f"Error: Could not download code for {name} from any URL.")
        return False
        
    # Extract
    print(f"Extracting to {temp_extract} ...")
    try:
        with zipfile.ZipFile(temp_zip, 'r') as zip_ref:
            zip_ref.extractall(temp_extract)
    except Exception as e:
        print(f"Error: Failed to extract ZIP file: {e}")
        if os.path.exists(temp_zip):
            os.remove(temp_zip)
        return False
        
    # Find the top level folder inside ZIP
    extracted_items = os.listdir(temp_extract)
    if not extracted_items:
        print("Error: Empty archive extracted.")
        shutil.rmtree(temp_extract)
        os.remove(temp_zip)
        return False
        
    source_dir = os.path.join(temp_extract, extracted_items[0])
    
    # Copy contents recursively to target folder
    print(f"Copying files from {source_dir} to {target_abs_path} ...")
    for item in os.listdir(source_dir):
        s = os.path.join(source_dir, item)
        d = os.path.join(target_abs_path, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
            
    # Cleanup temp
    try:
        shutil.rmtree(temp_extract)
        os.remove(temp_zip)
    except Exception as e:
        print(f"Warning: Cleanup failed for temp directories: {e}")
        
    print(f"Submodule '{name}' successfully flattened!\n")
    return True

def main():
    print("Starting submodule flattening script...")
    if not os.path.exists(gitmodules_path):
        print(f"No .gitmodules found at {gitmodules_path}. Nothing to flatten.")
        return
        
    submodules = parse_gitmodules(gitmodules_path)
    print(f"Found {len(submodules)} submodules in .gitmodules.")
    
    success_count = 0
    for sub in submodules:
        if download_and_extract_submodule(sub):
            success_count += 1
            
    print(f"Flattened {success_count}/{len(submodules)} submodules.")
    
    if success_count == len(submodules):
        try:
            os.remove(gitmodules_path)
            print("Removed .gitmodules.")
        except Exception as e:
            print(f"Warning: could not remove .gitmodules: {e}")
            
if __name__ == "__main__":
    main()
