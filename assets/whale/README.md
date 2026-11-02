# Jingle / 鲸铃 artwork

The two animated WebP files are copied unchanged from the user-supplied artwork in this workspace. No development-document directory is needed at runtime; all four images ship in the plugin package.

| Bundled file | Original, relative to `dev_docs/dsh-jingle-notch/` | Canvas | Frames | Use |
| --- | --- | --- | --- | --- |
| `layered.webp` | `WhaleJingleMac_v5_Layered/layered_motion.webp` | 288 × 324 | 103 | Idle, thinking, attention, finished and error |
| `working.webp` | `Jingle_V7_Animated_Working/Jingle_Working_Animated.webp` | 473 × 475 | 70 | Working / tool execution |

Both animations loop indefinitely. The V5 artwork has a transparent background. The V7 working artwork retains its original blue scene background. Session states add restrained CSS feedback; the two supplied animations provide the actual character motion. The state reference is `鲸铃：深海会话助手设定集.png` in the same development-documents directory.

The `*-poster.webp` files are first-frame fallbacks. macOS reduced-motion preferences select these static images and disable CSS movement. A failed animation decode retries its matching poster, then displays a whale symbol if decoding still fails. Resource failures are logged.

To regenerate a poster on macOS, run from this directory (requires the existing `sips` and WebP `cwebp` utilities):

```sh
poster_tmp=$(mktemp -d)
sips -s format png layered.webp --out "$poster_tmp/layered.png"
cwebp -q 88 "$poster_tmp/layered.png" -o layered-poster.webp
sips -s format png working.webp --out "$poster_tmp/working.png"
cwebp -q 88 "$poster_tmp/working.png" -o working-poster.webp
```

SHA-256:

```text
4e8e9045722a273829cfc80c8a66d6b823c63598dd49a5f7f53c388b7c019939  layered.webp
ef65d5bfa4a9e48e63e8567bf9828e6a93910de2e7ebc9a9649d7139471db183  working.webp
614fb77f2ac0637bedfa92d97656e5618d8645e4fb19d49564d275d6f45bb349  layered-poster.webp
8842d10374d8c0e07857925ffd1c24cac4d39c81d2c4929ec00d0ef7995a15a5  working-poster.webp
```
