export const drawRect = (rects, ctx) =>{
    // Set styling
    // const color = Math.floor(Math.random()*16777215).toString(16);
    // const color = 'ff0000'
    // ctx.strokeStyle = '#' + color

    // const text = item; 
    //ctx.font = '18px Arial';

    // Draw rectangles and text
    ctx.beginPath();   
    //ctx.fillStyle = '#' + color
    //ctx.fillText(text, x, y);

    const transparent = 'rgba(255, 0, 0, 0.5)'

    ctx.fillStyle = transparent;
    
    for(let i=0;i<rects.length;++i){
      var rect = new Path2D();
      rect.rect(rects[i].x, rects[i].y, rects[i].width, rects[i].height);
      ctx.strokeStyle = rects[i].color;
      ctx.lineWidth = rects[i].lineWidth;
      ctx.stroke(rect);
    }    
  }