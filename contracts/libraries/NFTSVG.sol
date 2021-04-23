// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity >=0.5.0;
/* pragma abicoder v2; */
/// @title NFTSVG
/// @notice Provides a function for generating an SVG associated with a Uniswap NFT
library NFTSVG {
    struct SVGParams {
        string quoteToken;
        string baseToken;
        string quoteTokenSymbol;
        string baseTokenSymbol;
        string feeTier;
        string color0;
        string color1;
        string color2;
        string color3;
        string x1;
        string y1;
        string x2;
        string y2;
        string x3;
        string y3;
    }

		function generateSVG(SVGParams memory params) internal pure returns (string memory svg) {
			return
					string(
							abi.encodePacked(
									generateSVGDefs(params),
									generateSVGBorderText(params),
									generateSVGCardMantle(params),
									generageSvgCurve(params)
							)
					);
		}

    function generateSVGDefs(SVGParams memory params) private pure returns (string memory svg) {
        /* string memory r1w = '290';
		string memory r1h = '500';
		string memory r1c = '42'; */
        svg = string(
            abi.encodePacked(
                '<svg width=\\"290\\" height=\\"500\\" viewBox=\\"0 0 290 500\\" xmlns=\\"http://www.w3.org/2000/svg\\"',
                /* '<!-- {\\"address\\": "0xe8ab59d3bcde16a29912de83a90eb39628cfc163", \\"msg\\": "Forged in SVG for Uniswap in 2021 by 0xe8ab59d3bcde16a29912de83a90eb39628cfc163\\",',
					'"sig": "0x2df0e99d9cbfec33a705d83f75666d98b22dea7c1af412c584f7d626d83f02875993df740dc87563b9c73378f8462426da572d7989de88079a382ad96c57b68d1b",',
					'\\"version\\": \\"2\\"} -->', */
                "xmlns:xlink='http://www.w3.org/1999/xlink'><style>@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@200;400&display=swap');</style><defs>"
                '<!-- Background gradient -->',
                "<filter id=\\\"f1\\\"><feImage result=\\\"p0\\\" xlink:href=\\\"data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='290px' height='500px' fill='%23",
                params.color0,
                "'/%3E%3C/svg%3E\\\" /><feImage result=\\\"p1\\\" xlink:href=\"data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='",
                params.x1,
                "}' cy='",
                params.y1,
                "' r='120px' fill='%23",
                params.color1,
                '\'/%3E%3C/svg%3E\\" />',
                "<feImage result=\\\"p2\\\" xlink:href=\\\"data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='",
                params.x2,
                "' cy='",
                params.y2,
                "' r='120px' fill='%23",
                params.color2,
                '\'/%3E%3C/svg%3E\\" />',
                '<feImage result=\\"p3\\"',
                " xlink:href=\"data:image/svg+xml;utf8,%3Csvg width='290' height='500' viewBox='0 0 290 500' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='",
                params.x3,
                "' cy='",
                params.y3,
                "' r='100px' fill='%23",
                params.color3,
                '\'/%3E%3C/svg%3E" /><feBlend mode=\\"overlay\\" in=\\"p0\\" in2=\\"p1\\" /><feBlend mode=\\"exclusion\\" in2=\\"p2\\" /><feBlend mode=\\"overlay\\" in2=\\"p3\\" result=\\"blendOut\\" /><feGaussianBlur in=\\"blendOut\\" stdDeviation=\\"42\\" /></filter>',
                '<!-- Clip path for gradients -->',
                ' <clipPath id=\\"corners\\"><rect width=\\"290\\" height=\\"500\\" rx=\\"42\\" ry=\\"42\\" /></clipPath>',
                '<!-- Outer text animation path. Must be a path for chrome support. Can be generated with elementToPath above. -->',
                '<path id=\\"text-path-a\\" d=\\"M40 12 H250 A28 28 0 0 1 278 40 V460 A28 28 0 0 1 250 488 H40 A28 28 0 0 1 12 460 V40 A28 28 0 0 1 40 12 z\\" />',
                '<!-- Minimap -->',
                '<path id=\\"minimap\\" d=\\"M234 444C234 457.949 242.21 463 253 463\\" />',
                '<!-- Top dark region blur filter -->',
                '<filter id=\\"top-region-blur\\"><feGaussianBlur in=\\"SourceGraphic\\" stdDeviation=\\"24\\" /></filter>',
                '<linearGradient id=\\"grad-up\\" x1=\\"1\\" x2=\\"0\\" y1=\\"1\\" y2=\\"0\\"><stop offset=\\"0.0\\" stop-color=\\"white\\" stop-opacity=\\"1\\" />',
                '<stop offset=\\".9\\" stop-color=\\"white\\" stop-opacity=\\"0\\" /></linearGradient>',
                '<!-- Positive out of range -->',
                '<linearGradient id=\\"grad-down\\" x1=\\"0\\" x2=\\"1\\" y1=\\"0\\" y2=\\"1\\"><stop offset=\\"0.0\\" stop-color=\\"white\\" stop-opacity=\\"1\\" /><stop offset=\\"0.9\\" stop-color=\\"white\\" stop-opacity=\\"0\\" /></linearGradient>',
                '<mask id=\\"fade-up\\" maskContentUnits=\\"objectBoundingBox\\"><rect width=\\"1\\" height=\\"1\\" fill=\\"url(#grad-up)\\" /></mask>',
                '<mask id=\\"fade-down\\" maskContentUnits=\\"objectBoundingBox\\"><rect width=\\"1\\" height=\\"1\\" fill=\\"url(#grad-down)\\" /></mask>',
                '<mask id=\\"none\\" maskContentUnits=\\"objectBoundingBox\\"><rect width=\\"1\\" height=\\"1\\" fill=\\"white\\" /></mask>',
                '<!-- Symbol text overflow -->',
                '<linearGradient id=\\"grad-symbol\\"><stop offset=\\"0.7\\" stop-color=\\"white\\" stop-opacity=\\"1\\" /><stop offset=\\".95\\" stop-color=\\"white\\" stop-opacity=\\"0\\" /></linearGradient>',
                '<mask id=\\"fade-symbol\\" maskContentUnits=\\"userSpaceOnUse\\"><rect width=\\"290px\\" height=\\"200px\\" fill=\\"url(#grad-symbol)\\" /></mask></defs>',
                '<g clip-path=\\"url(#corners)\\">',
                '<!-- Background and border -->',
                '<rect fill=\\"',
                params.color0,
                '\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"500px\\" />',
                '<rect style=\\"filter: url(#f1)\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"500px\\" />',
                '<!-- Top dark area -->',
                '<g style=\\"filter:url(#top-region-blur); transform:scale(1.5); transform-origin:center top;\\">',
                '<rect fill=\\"none\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"500px\\" />',
                '<ellipse cx=\\"50%\\" cy=\\"0px\\" rx=\\"180px\\" ry=\\"120px\\" fill=\\"#000\\" opacity=\\"0.85\\" /></g></g>'
            )
        );
    }

    function generateSVGBorderText(SVGParams memory params) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<!-- Outerdata string -->',
                '<text text-rendering=\\"optimizeSpeed\\">',
                '<textPath startOffset=\\"-100%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
                params.baseToken,
                unicode' • ',
                params.baseTokenSymbol,
                '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\" repeatCount=\\"indefinite\\" />',
                '</textPath> <textPath startOffset=\\"0%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
                params.baseToken,
                unicode' • ',
                params.baseTokenSymbol,
                '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\" repeatCount=\\"indefinite\\" /> </textPath>',
                '<textPath startOffset=\\"50%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
                params.quoteToken,
                unicode' • ',
                params.quoteTokenSymbol,
                '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\"',
                'repeatCount=\\"indefinite\\" /></textPath><textPath startOffset=\\"-50%\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-size=\\"10px\\" xlink:href=\\"#text-path-a\\">',
                params.quoteToken,
                unicode' • ',
                params.quoteTokenSymbol,
                '<animate additive=\\"sum\\" attributeName=\\"startOffset\\" from=\\"0%\\" to=\\"100%\\" begin=\\"0s\\" dur=\\"30s\\" repeatCount=\\"indefinite\\" /></textPath></text>'
            )
        );
    }

    function generateSVGCardMantle(SVGParams memory params) private pure returns (string memory svg) {
        svg = string(
            abi.encodePacked(
                '<!-- Card mantle -->'
                '<g mask=\\"url(#fade-symbol)\\"><rect fill=\\"none\\" x=\\"0px\\" y=\\"0px\\" width=\\"290px\\" height=\\"200px\\" />  <text y=\\"70px\\" x=\\"32px\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-weight=\\"200\\" font-size=\\"36px\\">',
                params.quoteTokenSymbol,
                '/',
                params.baseTokenSymbol,
                '</text><text y=\\"115px\\" x=\\"32px\\" fill=\\"white\\" font-family=\\"\'IBM Plex Mono\', monospace\\" font-weight=\\"200\\" font-size=\\"36px\\">',
                params.feeTier,
                '</text></g>',
                '<!-- Translucent inner border -->',
                '<rect x=\\"16\\" y=\\"16\\" width=\\"258\\" height=\\"468\\" rx=\\"26\\" ry=\\"26\\" fill=\\"rgba(0,0,0,0)\\" ',
                'stroke=\\"rgba(255,255,255,0.2)\\" /><rect x=\\"0\\" y=\\"0\\" width=\\"290\\" height=\\"468\\" rx=\\"42\\" ry=\\"42\\" fill=\\"rgba(0,0,0,0)\\" stroke=\\"rgba(255,255,255,0.2)\\" />'
            )
        );
    }

    function generageSvgCurve(SVGParams memory params) private pure returns (string memory svg) {
        // TODO: Make this a dynamic passed in data value
        int8 overRange;
        string memory fade = overRange == -1 ? '#fade-up' : overRange == 1 ? '#fade-down' : '#none';
        // TODO: Make curve dynamic
        string memory curve = 'M1 1C1 97 49 145 145 145';
        svg = string(
            abi.encodePacked(
                '<!-- Curve -->',
                '<g mask=\\"url(',
                fade,
                ')\\"',
                'style=\\"transform:translate(73px,209px)\\">'
                '<rect x=\\"-16px\\" y=\\"-16px\\" width=\\"180px\\" height=\\"180px\\" fill=\\"none\\" />'
                '<path d=\\"',
                curve,
                '\\" stroke=\\"rgba(0,0,0,0.3)\\" stroke-width=\\"32px\\" fill=\\"none\\" stroke-linecap=\\"round\\" />',
                '</g><g mask=\\"url(',
                fade,
                ')\\"',
                'style=\\"transform:translate(73px,209px)\\">',
                '<rect x=\\"-16px\\" y=\\"-16px\\" width=\\"180px\\" height=\\"180px\\" fill=\\"none\\" />',
                '<path d=\\"',
                curve,
                '\\" stroke=\\"rgba(255,255,255,1)\\" fill=\\"none\\" stroke-linecap=\\"round\\" /></g>',
                generateSVGCurveCircle(overRange)
            )
        );
    }

    function generateSVGCurveCircle(int8 overRange) private pure returns (string memory svg) {
        uint256 curvex1 = 73;
        uint256 curvey1 = 210;
        uint256 curvex2 = 217;
        uint256 curvey2 = 354;
        if (overRange == 1 || overRange == -1) {
            svg = string(
                abi.encodePacked(
                    '<circle cx=\\"',
                    overRange == 1 ? curvex1 : curvex2,
                    'px\\" cy=\\"',
                    overRange == 1 ? curvey1 : curvey2,
                    'px\\" r=\\"4px\\" fill=\\"white\\" /><circle cx=\\"',
                    overRange == 1 ? curvex1 : curvex2,
                    'px\\" cy=\\"',
                    overRange == 1 ? curvey1 : curvey2,
                    'px\\" r=\\"24px\\" fill=\\"none\\" stroke=\\"white\\" />'
                )
            );
        } else {
            svg = string(
                abi.encodePacked(
                    '<circle cx=\\"',
                    curvex1,
                    'px\\" cy=\\"',
                    curvey1,
                    'px\\" r=\\"4px\\" fill=\\"white\\" />',
                    '<circle cx=\\"',
                    curvex2,
                    'px\\" cy=\\"',
                    curvey2,
                    'px\\" r=\\"4px\\" fill=\\"white\\" />'
                )
            );
        }
    }
}
