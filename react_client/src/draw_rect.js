export const drawRect = (x, y, width, height, ctx) =>{
    // Set styling
    // const color = Math.floor(Math.random()*16777215).toString(16);
    const color = 'ff0000'
    ctx.strokeStyle = '#' + color

    // const text = item; 
    //ctx.font = '18px Arial';

    // Draw rectangles and text
    ctx.beginPath();   
    //ctx.fillStyle = '#' + color
    //ctx.fillText(text, x, y);

    ctx.lineWidth = "3";
    // ctx.strokeStyle = "red";
    ctx.rect(x, y, width, height); 
    ctx.stroke();
  }