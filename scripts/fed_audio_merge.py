#!/usr/bin/env python3
"""Merge KVM4 audio-only models from a backup config into the target config.

Comment-preserving, line-based: extracts the raw `- model_name:` blocks for the
KVM4-only audio lane (fed/audio-asr, fed/audio-tts, gemini-3.5-transcribe) from
<backup.yaml> and inserts them into <target.yaml> immediately before the
`litellm_settings:` section (i.e. appended to model_list).

Why: fed-deploy-kvm4.sh overwrites KVM4's config with KVM8 SOT, which drops the
audio lane that only KVM4 serves (OpenClaw ASR/TTS). This re-attaches it.

Block boundary: a model block ends at the next `- model_name:` OR the next
top-level section key (litellm_settings: / general_settings: / ...). This stops
the last audio block from swallowing the sections after model_list.

Usage: fed_audio_merge.py <backup.yaml> <target.yaml>
"""
import sys
import yaml

AUDIO = {'fed/audio-asr', 'fed/audio-tts', 'gemini-3.5-transcribe'}


def extract_audio_blocks(path):
    lines = open(path).read().splitlines()
    bounds = []  # (line_index, kind) where kind in {'model', 'section'}
    for i, ln in enumerate(lines):
        if ln.startswith('- model_name:'):
            bounds.append((i, 'model'))
        elif ln and not ln[0].isspace() and not ln.startswith('-') and ':' in ln:
            bounds.append((i, 'section'))
    blocks = []
    for idx, (i, kind) in enumerate(bounds):
        if kind != 'model':
            continue
        name = lines[i].split(':', 1)[1].strip()
        if name not in AUDIO:
            continue
        end = bounds[idx + 1][0] if idx + 1 < len(bounds) else len(lines)
        blocks.extend(lines[i:end])
    return blocks


def main():
    backup, target = sys.argv[1], sys.argv[2]

    audio_blocks = extract_audio_blocks(backup)
    if not audio_blocks:
        print("WARN: no audio blocks found in backup; nothing inserted")
        return 0

    target_lines = open(target).read().splitlines()
    ins = next((i for i, ln in enumerate(target_lines)
                if ln.startswith('litellm_settings:')), None)
    if ins is None:
        print("ERROR: no litellm_settings: marker in target")
        return 1

    # trim trailing blank lines at end of model_list so we don't stack blanks
    while ins > 0 and target_lines[ins - 1].strip() == '':
        ins -= 1
        del target_lines[ins]

    new_lines = target_lines[:ins] + audio_blocks + [''] + target_lines[ins:]
    out = '\n'.join(new_lines) + '\n'
    open(target, 'w').write(out)

    # validate: parse + confirm no duplicated top-level sections
    try:
        d = yaml.safe_load(out)
    except Exception as e:
        print(f"ERROR: merged config invalid YAML: {e}")
        return 1

    tops = [ln.split(':')[0].strip() for ln in out.splitlines()
            if ln and not ln[0].isspace() and ':' in ln and not ln.startswith('-')]
    from collections import Counter
    dup = {k: v for k, v in Counter(tops).items() if v > 1}
    if dup:
        print(f"ERROR: duplicated top-level sections after merge: {dup}")
        return 1

    n = len(d.get('model_list', []))
    print(f"OK: inserted {len(audio_blocks)} audio lines; model_list now {n} rungs")
    return 0


if __name__ == '__main__':
    sys.exit(main())
