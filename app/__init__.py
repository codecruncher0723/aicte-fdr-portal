import os, sys
# Add the actual backend 'app' package to the import search path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'app'))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)
# Extend the package's __path__ so submodule imports like 'app.routers' work
__path__.append(backend_path)
