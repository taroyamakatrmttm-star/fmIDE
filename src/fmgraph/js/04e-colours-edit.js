// ============================================================
// Choosing a rectangle's colour on fmGraph's page (a colour box, its Automatic swatch). Looking
// colours up is 04e-colours.js, the board engine's.
// ============================================================

// Chooses a rectangle's colour everywhere (null: back to the automatic one).
function setRectColour(key, colour){
  const c = colour === null ? null : cleanColour(colour);
  if(c) rectColours.set(key, c); else rectColours.delete(key);
  forgetAutoColours();
}

// A colour box's Automatic (the shared colour grid): the colour the rectangle goes back to,
// whether one is chosen now, and going back — one undo step, through done().
function automaticColour(key, fallback, done, name){
  return { colour: autoColours().get(key) || fallback, name, chosen: !!chosenColour(key),
    choose: () => { setRectColour(key, null); done(); } };
}

// A colour box's pick: choosing what the rectangle would have anyway clears the choice.
function chooseRectColour(key, colour){
  const c = cleanColour(colour);
  setRectColour(key, null);
  if(c && c !== shownColour(key)) setRectColour(key, c);
}
