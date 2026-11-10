"""The Steam menu entry choice is kept in a settings file (same option as
Steamcord #86). Decky's legacy API calls Plugin methods with the class itself
as `self`, so the helpers must work that way."""
import ast
import asyncio
import json
import os
from pathlib import Path
import tempfile
import types
import unittest

ROOT = Path(__file__).resolve().parents[1]


def plugin(settings_dir):
    tree = ast.parse((ROOT / 'main.py').read_text(encoding='utf-8'))
    cls = next(n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Plugin')
    body = [n for n in cls.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
            and n.name in {'_menu_path', 'get_menu_entry', 'set_menu_entry'}]
    ns = {'os': os, 'json': json, 'decky_plugin': types.SimpleNamespace(
        DECKY_PLUGIN_SETTINGS_DIR=settings_dir, logger=types.SimpleNamespace(warning=lambda *a: None))}
    module = ast.Module(body=[ast.ClassDef(name='Plugin', bases=[], keywords=[], body=body,
                                           decorator_list=[])], type_ignores=[])
    exec(compile(ast.fix_missing_locations(module), '<main.py>', 'exec'), ns)
    return ns['Plugin']


class MenuEntryBackendTests(unittest.TestCase):
    def test_round_trip_with_the_class_as_self(self):
        with tempfile.TemporaryDirectory() as tmp:
            P = plugin(tmp)
            self.assertIsNone(asyncio.run(P.get_menu_entry(P)))
            self.assertEqual(asyncio.run(P.set_menu_entry(P, on=False)), {'ok': True})
            self.assertEqual(asyncio.run(P.get_menu_entry(P)), 'off')
            asyncio.run(P.set_menu_entry(P, on=True))
            self.assertEqual(asyncio.run(P.get_menu_entry(P)), 'on')

    def test_hand_edited_value_is_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, 'menu-entry.json').write_text('{"menu": 1}')
            P = plugin(tmp)
            self.assertIsNone(asyncio.run(P.get_menu_entry(P)))


if __name__ == '__main__':
    unittest.main()
