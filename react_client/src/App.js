import { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import AWS from "aws-sdk";

import { drawRect } from "./draw_rect";

const videoConstraints = {
  width: 540, //720,
  height: 360,
  facingMode: "user",
};


/*
https://create-react-app.dev/docs/adding-custom-environment-variables/
https://create-react-app.dev/docs/adding-custom-environment-variables/#adding-development-environment-variables-in-env
https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Config.html
*/
AWS.config.update({
  accessKeyId: process.env.REACT_APP_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.REACT_APP_AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.REACT_APP_AWS_SESSION_TOKEN,
  region: process.env.REACT_APP_AWS_REGION
});
//console.log(`AWS.config.accessKeyId: ${AWS.config.credentials?.accessKeyId}`);
console.log(`AWS.config.region: ${AWS.config.region}`);

const rekognitionClient = new AWS.Rekognition({
  apiVersion: "2016-06-27",
});

// Face analysis by Amazon Rekognition
const detectFaces = async (imageData) => {
  const params = {
    Image: {
      Bytes: Buffer.from(
        imageData.replace("data:image/jpeg;base64,", ""),
        "base64"
      ),
    },
    Attributes: ["ALL"],
  };
  return await rekognitionClient.detectFaces(params).promise();
};

const getNumberOfPeople = (analyzeResult) => {
  return analyzeResult.FaceDetails.length;
};

// Analysis results: Confidence level
const getConfidence = (analyzeResult) => {
    return analyzeResult.FaceDetails[0].Confidence;
};

// Analysis results: Pose
const getPose = (analyzeResult) => {
  try {
    const pitch = analyzeResult.FaceDetails[0].Pose.Pitch;
    // const roll = analyzeResult.FaceDetails[0].Pose.Roll;
    const yaw = analyzeResult.FaceDetails[0].Pose.Yaw;
    // return {pitch, roll, yaw};
    return {pitch, yaw};
  } catch {
    return {pitch:0, yaw:0};
  }
};

// Analysis results: Eyeglasses
const getIsWearingEyeGlasses = (analyzeResult) => {
    return (analyzeResult.FaceDetails)[0].Eyeglasses.Value;
};

// Analysis results: Sunglasses
const getIsWearingSunGlasses = (analyzeResult) => {
  return analyzeResult.FaceDetails[0].Sunglasses.Value;
};

// Analysis results: Smile
const getIsSmile = (analyzeResult) => {
  return analyzeResult.FaceDetails[0].Smile.Value;
};

const getChinBottom = (analyzeResult) => {
  try {
    // analyzeResult.FaceDetails[0].Landmarks[27].Type ==> "chinBottom"
    const x = analyzeResult.FaceDetails[0].Landmarks[27].X,
          y = analyzeResult.FaceDetails[0].Landmarks[27].Y;
    return {x,y};
  } catch {
    return {x:-10,y:-10};
  }
};

// Analysis results: Left Eye
const getEyeLeft = (analyzeResult) => {
  const x = analyzeResult.FaceDetails[0].Landmarks[0].X,
        y = analyzeResult.FaceDetails[0].Landmarks[0].Y;

  return {x,y};
};

/* ************* */
//    APP
/* ************* */

const App = () => {

  let now = new Date();
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // constants
  const ANALYSIS_INTERVAL = 200; // every 0.2 seconds, analyze head and chin locations
  const SIGNS = {
    pass: 'images/green-check-mark.png',
    fail: 'images/red-x.png',
    none: 'images/bg.png'
  };
  const COUNTDOWN_MAX = 10;

  const [url, setUrl] = useState(null);
  const [analyzeResult, setRekognizeResult] = useState();
  // const [prevPose, setPrevPose] = useState({pitch:0, roll:0, yaw:0});
  const [prevPose, setPrevPose] = useState({pitch:0, yaw:0});
  const [headPitchYaw, setHeadPitchYaw] = useState(false);
  const [imgSign, setImgSign] = useState(SIGNS.none);
  const [verify, setVerify] = useState(false);
  const [seconds, setSeconds] = useState(COUNTDOWN_MAX);
  const [countdownColor, setCountdownColor] = useState('green');
  const [loginButtonDisplay, setLoginButtonDisplay] = useState('block');
  const [faceWithinConstraints, setFaceWithinConstraints] = useState(false);
  const [chinInPlace, setChinInPlace] = useState(false);

  const target_dot = {x:200, y:250};

  // update offset according to the video frame
  const init_videoOffset = {left:0, top:0, bottom:0}
  const [videoOffset, setVideoOffset] = useState(init_videoOffset);

  const handleUserMedia = () => {
    if(webcamRef.current && videoOffset.left === 0 && videoOffset.top === 0){
      setVideoOffset({
        left:webcamRef.current.video.offsetLeft, 
        top:webcamRef.current.video.offsetTop,
        bottom:webcamRef.current.video.offsetTop + 
        webcamRef.current.video.offsetHeight
      })
    }
  }
  
  const login = useCallback(() => {
    if (!verify) {
      setLoginButtonDisplay('none')
      setUrl(null)
      setHeadPitchYaw(false)
      setPrevPose({pitch:0, yaw:0})
      setSeconds(COUNTDOWN_MAX)
      setCountdownColor('green')
      setImgSign(SIGNS.none)
      setVerify(true);
      setRekognizeResult(null);
      setChinInPlace(false);
    }
  }, [SIGNS.none, verify]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setUrl(imageSrc);
      setRekognizeResult(undefined);
    }
  }, [webcamRef]);
  
  const analyzeHandler = useCallback( async() => {
    if(url){
      const result = await detectFaces(url);
      setRekognizeResult(result);

      const pose = getPose(result);
      const pitch = pose.pitch;
      const yaw = pose.yaw;

      if(prevPose.pitch !== 0 && prevPose.yaw !== 0) {

        const diff_pitch = Math.abs(pitch - prevPose.pitch);
        // const diff_roll = Math.abs(roll - prevPose.roll);
        const diff_yaw = Math.abs(yaw - prevPose.yaw);
    
        const diff_size_pitch = 15
        const diff_size_yaw = 25

        // console.log('diff_pitch: ' + diff_pitch);
        // console.log('diff_yaw: ' + diff_yaw);

        if(diff_pitch > diff_size_pitch ||
          // diff_roll > diff_size ||
          diff_yaw > diff_size_yaw) {
            setPrevPose({pitch:pitch, yaw:yaw})
            // setPrevPose({pitch:pitch, roll:roll, yaw:yaw})
            // console.log("Head move!");
            // console.log(diff_pitch + ', ' + diff_roll + ', ' + diff_yaw)
            
            setHeadPitchYaw(true)
            // console.log(diff_pitch + ', ' + diff_yaw)
        }
      } else {
        setPrevPose({pitch:pitch, yaw:yaw})
      }
    }
  // }, [url, prevPose.pitch, prevPose.roll, prevPose.yaw]);
  }, [url, prevPose.pitch, prevPose.yaw]);

  const getRealFaceRectBoundaries = () => {

    const color = 'blue'
    const lineWidth = 3

    try {
      const x_offset = 0;
      const y_offset = 5;
      const face_bounding_box = analyzeResult.FaceDetails[0].BoundingBox;
      /*
      BoundingBox:
      Height: 0.41345128417015076
      Left: 0.39006850123405457
      Top: 0.19800728559494019
      Width: 0.13521090149879456
      */

      // Get Video Properties
      const videoWidth = webcamRef.current.video.videoWidth;
      const videoHeight = webcamRef.current.video.videoHeight;
      // const videoOffsetLeft = webcamRef.current.video.offsetLeft
      // const videoOffsetTop = webcamRef.current.video.offsetTop

      const x = face_bounding_box.Left * videoWidth + x_offset;
      const y = face_bounding_box.Top * videoHeight + y_offset;
      const width = face_bounding_box.Width * videoWidth;
      const height = face_bounding_box.Height * videoHeight;
      const right = x + width;
      const bottom = y + height;

      return {x, y, width, height, right, bottom, color, lineWidth};
    } catch {
        return {x:-10, y:-10, 
                width:0, height:0, 
                right:0, bottom:0, 
                color:'white', lineWidth:0}
    }
  }

  const isFaceWithinConstraintsRect = () => {
    const diff_offset = 5;

    const constraints = getFaceBoundariesConstraints();

    if( getRealFaceRectBoundaries().x - diff_offset > constraints.x &&
        getRealFaceRectBoundaries().y - diff_offset > constraints.y &&
        getRealFaceRectBoundaries().right + diff_offset < constraints.right &&
        getRealFaceRectBoundaries().bottom + diff_offset < constraints.bottom ){
          if(!faceWithinConstraints){
            setFaceWithinConstraints(true);
          }
        }
    else {
      if(faceWithinConstraints){
        setFaceWithinConstraints(false);
      }
      if(prevPose.pitch !==0 || prevPose.yaw !== 0) {
        setPrevPose({pitch:0, yaw:0});
      }
    }
  }

  const getFaceBoundariesConstraints = () => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    const x_offset = -20;
    const y_offset = -30;
    const with_offset = 40;
    const height_offset = 60;


    const x = (videoWidth / 3) + x_offset;
    const y = (videoHeight / 4) + y_offset;
    const width = (videoWidth / 3) + with_offset;
    const height = (videoHeight / 2) + height_offset;

    const right = x + width;
    const bottom = y + height;

    return({x, y, right, bottom, width, height});
  }
  
  const getFaceBoundariesConstraintsRect = () => {
 
    const faceLocation = {
      in:{
        lineWidth: 3,
        color: 'green'
      },
      out:{
        lineWidth: 4,
        color: 'red'
      },
    }
    let currFaceLocation = faceLocation.out

    isFaceWithinConstraintsRect();
    if (faceWithinConstraints){
      currFaceLocation = faceLocation.in
    }

    const color = currFaceLocation.color
    const lineWidth = currFaceLocation.lineWidth

    const constraints = getFaceBoundariesConstraints();
    const x = constraints.x;
    const y = constraints.y;
    const width = constraints.width;
    const height = constraints.height;

    return{x, y, width, height, color, lineWidth};
  }

  const getTargetRect = () => {
 
    const width = 5;
    const height = 5; 
    const color = 'yellow'
    const lineWidth = 3
    const x = target_dot.x;
    const y = target_dot.y;
    
    return{x, y, width,height, color, lineWidth};
  }

  const getChinRect = () => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // chin offsets
    const x_offset = -24;
    const y_offset = -25;

    // Chin boundary
    const x = (getChinBottom(analyzeResult).x  * videoWidth) + x_offset;
    const y = (getChinBottom(analyzeResult).y  * videoHeight) + y_offset;
    const width = 40;
    const height = 20; 
    const color = 'purple'
    const lineWidth = 3

    isChinInPlace({x, y, width,height})

    return{x, y, width,height, color, lineWidth};
  }

  const isChinInPlace = (chinRect) => {
    
    const chin_left = chinRect.x;
    const chin_top = chinRect.y;
    const chin_right = chinRect.x + chinRect.width;
    const chin_bottom = chinRect.y + chinRect.height;

    // console.log('chin_left: ' + chin_left);
    // console.log('chin_top: ' + chin_top);

    // console.log('chinInPlace: ' + chinInPlace);

    if(chin_left < target_dot.x &&
       chin_top < target_dot.y &&
       chin_right > target_dot.x &&
       chin_bottom > target_dot.y &&
       !chinInPlace) {
        setChinInPlace(true);
    }
    // else if(chinInPlace) {
    //   setChinInPlace(false);
    // }
  }

  const drawAllRects = () => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;
    // const videoOffsetLeft = webcamRef.current.video.offsetLeft
    // const videoOffsetTop = webcamRef.current.video.offsetTop

    // Set canvas height and width
    canvasRef.current.width = videoWidth;
    canvasRef.current.height = videoHeight;
    // const offsetLeft = canvasRef.current.offsetLeft;
    // const offsetTop = canvasRef.current.offsetTop;   

    const ctx = canvasRef.current.getContext("2d");

    let rects = [];
    // Real face rect
    // rects.push(getRealFaceRectBoundaries())
    // Face boundary constraints
    rects.push(getFaceBoundariesConstraintsRect())
    // Chin boundary rect
    rects.push(getChinRect())
    // Target boundary rect
    rects.push(getTargetRect());

    drawRect(rects, ctx);
  }

  const verificationResults = useCallback( async() => {
    if (url && 
        verify && 
        headPitchYaw &&
        faceWithinConstraints &&
        chinInPlace) 
    { 
      setVerify(false);
      setImgSign(SIGNS.pass)
      setLoginButtonDisplay('block')
    }
  }, [url, verify, SIGNS.pass, 
      headPitchYaw, 
      faceWithinConstraints,
      chinInPlace]);

  const { current } = webcamRef;
  useEffect(handleUserMedia, [current, videoOffset.left, videoOffset.top]);

  useEffect(() => {
    const interval = setInterval(() => {
      if(verify){
        verificationResults();
        capture();
        analyzeHandler();
      }
    }, ANALYSIS_INTERVAL);
    return () => clearInterval(interval); // This represents the unmount function, in which we need to clear your interval to prevent memory leaks.
  }, [capture, analyzeHandler, verify, verificationResults])

  
  useEffect(() => {
    if (verify && seconds > 0) {
      setTimeout(() => setSeconds(seconds - 1), 1000);
      if(seconds < COUNTDOWN_MAX/2){
        setCountdownColor('red');
      }
    } else if (verify) {
      //setSeconds(COUNTDOWN_MAX);
      setVerify(false);
      setImgSign(SIGNS.fail);
      setLoginButtonDisplay('block')
    }
  }, [verify, seconds, SIGNS.pass, SIGNS.fail]);

/* ************* */
//    RETURN
/* ************* */

  return (
    <div className="App">       
      {(
      <>
        <div className="webcam">
          <Webcam
            style={{
              position: "absolute",
              marginLeft: "auto",
              marginRight: "auto",
              left: 0,
              right: 0,
              textAlign: "center",
              zindex: 8,
              width: 540,
              height: 360,
              // width: 640,
              // height: 480,
            }}
            audio={false}
            width={540}
            height={360}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
          />
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              marginLeft: "auto",
              marginRight: "auto",
              left: 0,
              right: 0,
              textAlign: "center",
              zindex: 8,
              width: 540,
              height: 360,
              // width: 640,
              // height: 480,
            }}
          />
        </div>
        <div>
          <button
          style={{
            left: videoOffset.left,
            top: videoOffset.bottom + 25,
            display: loginButtonDisplay
          }}
          onClick={login}
          >Verify!</button>
        </div>
      </>
      )}
      <header className="header"
        style={{
          left: videoOffset.left,
          top: videoOffset.bottom + 60
        }}
        >
        <h1>Liveness Detection</h1>
      </header>

      <img src={imgSign} className="verify_icon" alt=" "
        style={{
          left: videoOffset.left + 230,
          top: videoOffset.bottom + 18
        }}
      ></img>

      {url && verify && (
        <>
          <countdown className="countdown"
            style={{
              left: videoOffset.left + 245,
              top: videoOffset.bottom + 25,
              color: countdownColor
            }}
          >
            <h2>{seconds}</h2>
          </countdown>

          {/* <div>{analyzeHandler()}</div> */}
          {/* <div>{setUrl(undefined)}</div> */}
          {/* <div>
            {
              setInterval(function() {
                analyzeHandler()
              }, 10000)
            }
          </div> */}
          {/* <div>
            <button 
            style={{
              left: videoOffset.left,
              top: videoOffset.bottom
            }}
            onClick={() => analyzeHandler()}>Analyze</button>
          </div> */}
          {/* <div>
            <img src={url} alt="Screenshot" />
          </div> */}
          {typeof analyzeResult !== "undefined" && (
            <div className="analyzeResult">
              {/* <div>{"Number of People: " + getNumberOfPeople(analyzeResult)}</div>
              <div>{"Confidence: " + getConfidence(analyzeResult)}</div>
              <div>
                {"Now: " +
                now.getMinutes() + ":" + 
                now.getSeconds()}
              </div>
              <div>
                {"Pose: " +
                  getPose(analyzeResult).pitch +
                  ", " +
                  getPose(analyzeResult).roll + 
                  ", " +
                  getPose(analyzeResult).yaw}
              </div>
              <div>
                {"Eyeglasses: " + getIsWearingEyeGlasses(analyzeResult)}
              </div>
              <div>
                {"Sunglasses: " + getIsWearingSunGlasses(analyzeResult)}
              </div>
              <div>
                {"Smile: " + getIsSmile(analyzeResult)}
              </div>
              <div>
                {"Left eye: " + 
                  getEyeLeft(analyzeResult).x + 
                  ", " +
                  getEyeLeft(analyzeResult).y}
              </div> */}
              <div>
                {drawAllRects(analyzeResult)}
              </div>
              {/* <div>
                {setFaceRectBoundaries(getFaceBoundingBox(analyzeResult).Left, 
                      getFaceBoundingBox(analyzeResult).Top,
                      getFaceBoundingBox(analyzeResult).Width,
                      getFaceBoundingBox(analyzeResult).Height)}
              </div> */}
              {/* <div>
                {rect(getEyeLeft(analyzeResult).x, 
                      getEyeLeft(analyzeResult).y)}
              </div>
              <div>
                {rect(getChinBottom(analyzeResult).x, 
                      getChinBottom(analyzeResult).y)}
              </div> */}
              {/* <button 
              style={{
                left: videoOffset.left,
                top: videoOffset.bottom
              }}
              onClick={capture}>Capture!</button> */}
              {/* {capture()} */}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default App;