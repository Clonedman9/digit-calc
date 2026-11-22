#!/usr/bin/env python3
"""Browser geometry regression using the existing agent-browser CLI; no dependencies."""
import json
import subprocess
import sys

session = sys.argv[1] if len(sys.argv) > 1 else "digit-calc-ipad-layout"

def run(*args, script=None):
    result = subprocess.run(["agent-browser", "--session", session, *args], input=script, text=True, capture_output=True, check=True)
    return result.stdout.strip()

geometry = """(() => {
  const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,centerX:r.x+r.width/2,centerY:r.y+r.height/2}; };
  return { viewport:[innerWidth,innerHeight], equation:rect('#qExpr'), keyboard:rect('#keypad'), key:rect('[data-k="1"]'), submit:rect('#submitBtn'), skip:rect('#skipBtn'), sidebarDisplay:getComputedStyle(document.querySelector('.sidebar')).display, keyboardCount:document.querySelectorAll('#keypad').length, documentWidth:document.documentElement.scrollWidth };
})()"""

sizes = [(768,1024),(810,1080),(820,1180),(834,1194),(1024,768),(1180,820),(1194,834),(1366,1024),(1024,650),(1180,650),(1024,560),(1440,900),(390,844),(320,740)]
measurements = []
for width, height in sizes:
    run("set", "viewport", str(width), str(height))
    # Geometry operations do not interact with stale element refs.
    run("snapshot", "-i")
    item = json.loads(run("eval", "--stdin", script=geometry))
    assert item["keyboardCount"] == 1, item
    assert item["documentWidth"] <= width, item
    assert abs(item["keyboard"]["centerX"] - width/2) <= 1, item
    assert abs(item["equation"]["centerX"] - width/2) <= 1, item
    assert item["equation"]["bottom"] < item["keyboard"]["y"], item
    assert item["equation"]["centerY"] < height*0.4, item
    if width >= 701:
        assert item["sidebarDisplay"] == "none", item
        assert item["keyboard"]["width"] >= min(650, width-100), item
        assert item["key"]["height"] >= 44, item
        assert item["submit"]["bottom"] <= height-1, item
        assert item["skip"]["bottom"] <= height-1, item
        assert abs(item["submit"]["width"]-item["skip"]["width"]) < 1, item
    measurements.append(item)
print(json.dumps({"passed":True,"measurements":measurements}, ensure_ascii=False, indent=2))
