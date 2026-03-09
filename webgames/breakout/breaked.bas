#cmdline "-s gui"
#include "fbgfx.bi"

#define NUMSTAGES   32
#define CENTERED    -1
#define BLOCKWID    64
#define BLOCKHEI    32

dim shared as byte stage(NUMSTAGES-1, 9, 9)
dim shared as byte currentStage = 0

dim shared as byte blockType = 1

dim shared as long mouseX, mouseY, mouseBtn


sub label (x as long, y as long, c as long, s as string)
	if x = CENTERED then x =40 - (len(s) / 2)	  	'center print
	locate y, x
	color c
	print s	
end sub


sub main()
  dim as byte running = 1
  dim as byte DrawFlag = 1
  dim as string action
  dim as long fh
  
  '' begin
  screenres 640, 480, 8,, (fb.GFX_WINDOWED or fb.GFX_NO_SWITCH)
  
  '' load stages
  fh = freefile()
  open "breakout.lev" for input as #fh 
    for st as long = 0 to NUMSTAGES-1
      for y as long = 0 to 9
        for x as long = 0 to 9
          input #fh, stage(st, x, y)
        next x
      next y
    next st
  close fh
  
  while running
    
    action = inkey
    
    select case lcase(action)
    case chr(27)
      running = 0
      
    '' block types
    case "1": blockType = 1
    case "2": blockType = 2
    case "3": blockType = 3
    case "4": blockType = 4
    case "5": blockType = 5
    case "6": blockType = 6
    case "7": blockType = 7
      
    '' select editing stage number
    case "+"
      if currentStage < NUMSTAGES-1 then 
        currentStage +=1
        drawFlag = 1
      end if
      
    case "-"
      if currentStage > 0 then 
        currentStage -= 1
        drawFlag = 1
      end if
      
    end select
    
    
    getmouse (mouseX, mouseY,, mouseBtn)
    
    if mouseY < 320 then
      select case mouseBtn
      case 1
        ' draw selected block
        if stage(currentStage, int(mouseX/BLOCKWID), int(mouseY/BLOCKHEI)) <> blockType then
          stage(currentStage, int(mouseX/BLOCKWID), int(mouseY/BLOCKHEI)) = blockType
          drawFlag = 1
        end if
      case 2
        ' delete selected block
        if stage(currentStage, int(mouseX/BLOCKWID), int(mouseY/BLOCKHEI)) <> 0 then
          stage(currentStage, int(mouseX/BLOCKWID), int(mouseY/BLOCKHEI)) = 0
          drawFlag = 1
        end if
      case 4
        ' pick selected block for painting
        blockType = stage(currentStage, int(mouseX/BLOCKWID), int(mouseY/BLOCKHEI))
      end select
    end if
    
    
    '' draw screen
    if drawFlag then
      screenlock
      cls
      
      line(0,   0)-(639, 479), 0,   bf															
      line(0, 328)-(639, 329), 244, bf
      line(0, 451)-(639, 454), 41,  bf
      
      for y as long = 0 to 9
        for x as long = 0 to 9
        	line(x*BLOCKWID, y*BLOCKHEI) - (BLOCKWID + x*BLOCKWID, BLOCKHEI + y*BLOCKHEI), 244, b
          if stage(currentStage, x, y) > 0 then
					'draw the block in the stored color of the playfield index
					line ((1+x*BLOCKWID), (1+y*BLOCKHEI))-((x*BLOCKWID)+63, (y*BLOCKHEI)+31), stage(currentStage, x, y),bf
				end if
        next x
      next y
      
      label ( 5, 59, 15, "[1]     [2]     [3]     [4]     [5]     [6]     [7]" )
      for x as long = 1 to 7
        color x
        locate 59, x*8
        print chr(254)
      next

      label ( 65, 59, 15, "+/- STAGE " + str( currentStage+1 ) )
      
      screenunlock
      
      drawFlag = 0
    end if
    
    sleep 8,1
    
  wend
  
  '' save stages
  fh = freefile()
  open "breakout.lev" for output as #fh 
    for st as long = 0 to NUMSTAGES-1
      for y as long = 0 to 9
        for x as long = 0 to 9
          print #fh, stage(st, x, y) & chr(32);
        next x
        print #fh, ""
      next y
    next st
  close fh
end sub

main()
