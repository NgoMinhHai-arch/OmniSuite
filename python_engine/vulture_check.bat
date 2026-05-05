@echo off
echo Running Vulture to find dead code in python_engine...
vulture . --min-confidence 60
pause
