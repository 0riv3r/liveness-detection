import { useRef, useState, useEffect, useCallback } from "react";
import Webcam from "react-webcam";
import AWS from "aws-sdk";
import { CountdownCircleTimer } from "react-countdown-circle-timer";

import { drawRect } from "./draw_rect";

const videoConstraints = {
  width: 540, //720,
  height: 360,
  facingMode: "user",
};

const renderTime = ({ remainingTime }) => {
  if (remainingTime === 0) {
    return <div className="timer">Too lale...</div>;
  }

  return (
    <div className="timer">
      <div className="text">Remaining</div>
      <div className="value">{remainingTime}</div>
      <div className="text">seconds</div>
    </div>
  );
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
  const [url, setUrl] = useState(null);

  const ANALYSIS_INTERVAL = 200; // every 0.3 seconds, analyze head and chin locations

  // update offset according to the video frame
  const init_videoOffset = {left:0, top:0, bottom:0}
  const [videoOffset, setVideoOffset] = useState(init_videoOffset);

  const handleUserMedia = () => {
    if(webcamRef.current && videoOffset.left === 0 && videoOffset.top === 0){
      setVideoOffset({
        left:webcamRef.current.video.offsetLeft, 
        top:webcamRef.current.video.offsetTop,
        bottom:webcamRef.current.video.offsetTop + webcamRef.current.video.offsetHeight
      })
    }
  }
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setUrl(imageSrc);
      setRekognizeResult(undefined);
    }
  }, [webcamRef]);

  const [analyzeResult, setRekognizeResult] = useState();
  // const analyzeHandler = async () => {
  //   const result = await detectFaces(url);
  //   setRekognizeResult(result);
  //   console.log(result);
  // };

  // const [prevPose, setPrevPose] = useState({pitch:0, roll:0, yaw:0});
  const [prevPose, setPrevPose] = useState({pitch:0, yaw:0});
  const [imgPath, setImgPath] = useState('images/bg.png');
  const analyzeHandler = useCallback( async() => {
    if(url){
      const result = await detectFaces(url);
      setRekognizeResult(result);

      const pose = getPose(result);
      
      // const pitch = result.FaceDetails[0].Pose.Pitch;
      // const roll = result.FaceDetails[0].Pose.Roll;
      // const yaw = result.FaceDetails[0].Pose.Yaw;

      const pitch = pose.pitch;
      const yaw = pose.yaw;
  
      const diff_pitch = Math.abs(pitch - prevPose.pitch);
      // const diff_roll = Math.abs(roll - prevPose.roll);
      const diff_yaw = Math.abs(yaw - prevPose.yaw);
  
      const diff_size = 30

      if(diff_pitch > diff_size ||
         // diff_roll > diff_size ||
         diff_yaw > diff_size) {
          setPrevPose({pitch:pitch, yaw:yaw})
          // setPrevPose({pitch:pitch, roll:roll, yaw:yaw})
          // console.log("Head move!");
          // console.log(diff_pitch + ', ' + diff_roll + ', ' + diff_yaw)

          setImgPath('images/green-check-mark.png')
          console.log(diff_pitch + ', ' + diff_yaw)
      }
    }
  // }, [url, prevPose.pitch, prevPose.roll, prevPose.yaw]);
  }, [url, prevPose.pitch, prevPose.yaw]);

  const getRealFaceRectBoundaries = (analyzeResult) => {

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

      const color = 'purple'

      return {x, y, width, height, right, bottom, color};
    } catch {
        return {x:-10, y:-10, 
                width:0, height:0, 
                right:0, bottom:0, color:'white'}
    }
  }

  const getFaceBoundariesConstraints = (analyzeResult) => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    let color = 'red'

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

    const diff_offset = 5;

    if( getRealFaceRectBoundaries(analyzeResult).x - diff_offset > x &&
        getRealFaceRectBoundaries(analyzeResult).y - diff_offset > y &&
        getRealFaceRectBoundaries(analyzeResult).right + diff_offset < right &&
        getRealFaceRectBoundaries(analyzeResult).bottom + diff_offset < bottom ){
          color = 'green'
        }

    return{x, y, width,height, color};
  }

  const getChinRect = (analyzeResult) => {
    // Get Video Properties
    const videoWidth = webcamRef.current.video.videoWidth;
    const videoHeight = webcamRef.current.video.videoHeight;

    // chin offsets
    const x_offset = -19;
    const y_offset = -17;

    // Chin boundary
    const x = (getChinBottom(analyzeResult).x  * videoWidth) + x_offset;
    const y = (getChinBottom(analyzeResult).y  * videoHeight) + y_offset;
    const width = 40;
    const height = 20; 
    const color = 'yellow'

    return{x, y, width,height, color};
  }

  const drawAllRects = (analyzeResult) => {
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
    rects.push(getRealFaceRectBoundaries(analyzeResult))
    // Face boundary constraints
    rects.push(getFaceBoundariesConstraints(analyzeResult))
    // Chin boundary rect
    rects.push(getChinRect(analyzeResult))

    drawRect(rects, ctx);
  }

  const { current } = webcamRef;
  useEffect(handleUserMedia, [current, videoOffset.left, videoOffset.top]);

  useEffect(() => {
    const interval = setInterval(() => {
      capture();
      analyzeHandler();
    }, ANALYSIS_INTERVAL);
    return () => clearInterval(interval); // This represents the unmount function, in which we need to clear your interval to prevent memory leaks.
  }, [capture, analyzeHandler])

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
        {/* <div>
          <button
          style={{
            left: videoOffset.left,
            top: videoOffset.bottom
          }}
          onClick={capture}
          >Capture!</button>
        </div> */}
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
      <img src={imgPath} className="verify_icon" alt=" "
        style={{
          left: videoOffset.left,
          top: videoOffset.bottom + 20
      }}
      ></img>
      <div className="timer-wrapper">
        <CountdownCircleTimer
          style={{
            left: videoOffset.left,
            top: videoOffset.bottom + 20
          }}
          isPlaying
          duration={10}
          colors={[["#004777", 0.33], ["#F7B801", 0.33], ["#A30000"]]}
          onComplete={() => [true, 1000]}
        >
          {renderTime}
        </CountdownCircleTimer>
      </div>
      {url && (
        <>
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