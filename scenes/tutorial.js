// scenes/tutorial.js
import { setCurrentDifficulty, difficultySettings } from "../components/utils/difficultyManager.js";
import { setSelectedSkill, getSelectedSkill, skillSettings } from "../components/player/skillManager.js";

export function TutorialScene(k) {
  k.scene("tutorial", () => {
    const centerY = k.height() / 2;
    const centerX = k.width() / 2;

    // --- LEFT COLUMN: DYNAMIC SKILL SELECTION ---
    const skillButtonSpacing = 80;
    const buttonWidth = 200;
    const buttonHeight = 60;
    let currentSelectedSkillKey = getSelectedSkill(); 

    const leftColumnX = k.width() * 0.25;

    k.add([
      k.text("Select a Skill", { size: 32, align: "center" }),
      k.anchor("center"),
      k.pos(leftColumnX, centerY - 220),
    ]);

    // Add a text object to display the skill description
    const skillDescriptionText = k.add([
      k.text(skillSettings[currentSelectedSkillKey].description, {
        size: 18,
        align: "center",
        width: buttonWidth + 40, 
      }),
      k.anchor("top"),
      k.pos(leftColumnX, centerY - 180),
    ]);

    const skillsToDisplay = Object.keys(skillSettings).map((key) => ({
      key: key,
      label: skillSettings[key].name,
      description: skillSettings[key].description,
    }));

    const skillButtons = [];

    skillsToDisplay.forEach((skill, i) => {
      const buttonCenter = k.vec2(
        leftColumnX,
        centerY + 20 + (i - (skillsToDisplay.length - 1) / 2) * skillButtonSpacing
      );

      const btn = k.add([
        k.rect(buttonWidth, buttonHeight, { radius: 8 }),
        k.pos(buttonCenter),
        k.anchor("center"),
        k.color(0, 0, 0),
        k.outline(4, k.rgb(128, 128, 128)),
        k.area(),
        k.z(10),
        { skillKey: skill.key },
      ]);

      const btnText = btn.add([
        k.text(skill.label, { size: 24 }),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(20),
      ]);

      skillButtons.push({ btn, btnText, key: skill.key });

      btn.onHover(() => {
        k.setCursor("pointer");
        skillDescriptionText.text = skill.description;
        if (currentSelectedSkillKey !== skill.key) {
          btn.color = k.rgb(100, 100, 100);
        }
      });

      btn.onHoverEnd(() => {
        k.setCursor("default");
        skillDescriptionText.text = skillSettings[currentSelectedSkillKey].description;
        if (currentSelectedSkillKey !== skill.key) {
          btn.color = k.rgb(0, 0, 0);
        }
      });

      btn.onClick(() => {
        currentSelectedSkillKey = skill.key;
        setSelectedSkill(skill.key);

        skillButtons.forEach((b) => {
          if (b.key === currentSelectedSkillKey) {
            b.btn.color = k.rgb(255, 255, 255);
            b.btnText.color = k.rgb(0, 0, 0);
            b.btn.outline.color = k.rgb(255, 255, 255);
          } else {
            b.btn.color = k.rgb(0, 0, 0);
            b.btnText.color = k.rgb(255, 255, 255);
            b.btn.outline.color = k.rgb(128, 128, 128);
          }
        });
      });
    });

    const updateSelectedVisual = () => {
      const selectedButton = skillButtons.find((b) => b.key === currentSelectedSkillKey);
      if (selectedButton) {
        selectedButton.btn.color = k.rgb(255, 255, 255);
        selectedButton.btnText.color = k.rgb(0, 0, 0);
        selectedButton.btn.outline.color = k.rgb(255, 255, 255);
      }
    };

    updateSelectedVisual();

    // --- CENTER COLUMN: INSTRUCTIONS ---
    const instructions = [
      "Controls",
      "-------------------",
      "Move: WASD / Arrows",
      "Fire: Left Mouse",
      "Dash: SPACE",
      "Special: E",
      "Autoshoot: R",
      "Pause: P",
    ];

    instructions.forEach((text, i) => {
      k.add([
        k.text(text, { size: 24 }),
        k.anchor("center"), // Center the text for a cleaner look
        k.pos(centerX, centerY + (i - (instructions.length - 1) / 2) * 50),
      ]);
    });

    // --- RIGHT COLUMN: DIFFICULTY SELECTION ---
    const rightColumnX = k.width() * 0.75;
    const difficultyButtonSpacing = 100;

    k.add([
      k.text("Select difficulty\nto start the game", { size: 32, align: "center" }),
      k.anchor("center"),
      k.pos(rightColumnX, centerY - 200),
    ]);

    const difficulties = [
      { key: "easy", label: difficultySettings.easy.name },
      { key: "normal", label: difficultySettings.normal.name },
      { key: "hard", label: difficultySettings.hard.name },
    ];

    difficulties.forEach((diff, i) => {
      const buttonCenter = k.vec2(
        rightColumnX,
        centerY + 40 + (i - (difficulties.length - 1) / 2) * difficultyButtonSpacing
      );

      const btn = k.add([
        k.rect(buttonWidth, 80, { radius: 8 }),
        k.pos(buttonCenter),
        k.anchor("center"),
        k.color(0, 0, 0),
        k.outline(4, k.rgb(255, 255, 255)),
        k.area(),
        k.z(10),
        { difficultyKey: diff.key },
      ]);

      const btnText = btn.add([
        k.text(diff.label, { size: 28 }),
        k.anchor("center"),
        k.color(255, 255, 255),
        k.z(20),
      ]);

      btn.onHover(() => {
        k.setCursor("pointer");
        btn.color = k.rgb(255, 255, 255);
        btnText.color = k.rgb(0, 0, 0);
      });

      btn.onHoverEnd(() => {
        k.setCursor("default");
        btn.color = k.rgb(0, 0, 0);
        btnText.color = k.rgb(255, 255, 255);
      });

      btn.onClick(() => {
        setCurrentDifficulty(btn.difficultyKey);
        k.go("game");
      });
    });
  });
}