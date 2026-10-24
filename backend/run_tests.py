import sys
from pathlib import Path
import pytest

# Ensure backend root is on sys.path
backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == '__main__':
    args = sys.argv[1:] if len(sys.argv) > 1 else [str(Path(backend_dir) / 'tests'), '-v']
    sys.exit(pytest.main(args))
