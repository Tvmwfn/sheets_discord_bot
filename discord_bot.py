import os
import asyncio
import csv
import logging
from io import BytesIO
import discord
import requests
from PIL import Image, ImageDraw, ImageFont
from discord.ext import commands

# from oauthlib.oauth2 import BackendApplicationClient
# from requests_oauthlib import OAuth2Session
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

# import google.auth
# from googleapiclient.errors import HttpError
from table2ascii import table2ascii  # , Alignment, PresetStyle

from typing import TypeAlias

logging.basicConfig(level=logging.DEBUG)

os.chdir("/data")

context: TypeAlias = commands.Context

# SECRETS_FILE = ""

with open("discord-token", "r", encoding="utf") as file:
    BOT_TOKEN = file.read().strip("\n")

SCOPES = [
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/script.external_request",
]


def create_image(links, xnumbers):
    "Look up card images and stitch them together with numbers underneath."
    im = []
    for index, link in enumerate(links):
        response = requests.get(link, timeout=1)
        im.append(Image.open(BytesIO(response.content)))

    total_width = sum(image.width for image in im)
    max_height = max(image.height for image in im)

    dst = Image.new("RGB", (total_width, max_height + 40))  # Increased height for text

    offset = 0
    draw = ImageDraw.Draw(dst)
    font_size = 30  # Adjust the font size as needed
    font = ImageFont.truetype("arial.ttf", font_size)

    for index, image in enumerate(im):
        dst.paste(image, (offset, 0))
        text = str(xnumbers[index])
        text_width = draw.textlength(text, font=font)
        text_position = (
            offset + (image.width - text_width) // 2,
            max_height,
        )  # Centered below the image
        draw.text(text_position, text, fill="white", font=font)
        offset += image.width

    return dst


def get_instance_by_channel(channel):
    with open("game_assignments.csv", "r") as file:
        reader = csv.reader(file)
        next(reader)  # Skip the header row

        for row in reader:
            if str(row[0]) == str(channel):
                return row

    return None


async def make_google_service(ctx: context, serviceName="script", version="v1"):
    xinstance = get_instance_by_channel(ctx.channel.id)
    if xinstance is None:
        await ctx.send("Please use this command in a game thread.")
        return
    spreadsheet_id = xinstance[1]
    deployment_id = xinstance[2]

    # set up credentials
    creds = None
    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(SECRETS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        with open("token.json", "w") as token:
            token.write(creds.to_json())

    # create a Google Sheets service
    service = build(serviceName, version, credentials=creds)

    return spreadsheet_id, deployment_id, service


async def log_error_response(response, ctx=None):
    error_info = response["error"]
    if ctx is not None:
        await ctx.send(error_info["details"][0]["errorMessage"])

    raise Exception(
        "\nApps Script execution error:"
        + "\n    "
        + "\n    ".join([f"{k}: {v}" for k, v in error_info["details"][0].items()])
    )


async def get_response(service, request, deployment_id, ctx):
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        await log_error_response(response, ctx)
    return response


async def call_apps_script_function(ctx, function, parameters):
    """Calls FUNCTION on sheet determined by CTX with PARAMETERS.
    If the parameter is the context-sensitive spreadsheet_id,
    then use the special string SPREADSHEET_ID and it will be replaced with
    the appropriate value."""
    spreadsheet_id, deployment_id, service = await make_google_service(ctx)
    request = {"function": function, "parameters": parameters}
    for i, parameter in enumerate(request["parameters"]):
        if parameter == "SPREADSHEET_ID":
            request["parameters"][i] = str(spreadsheet_id)
    response = await get_response(service, request, deployment_id, ctx)
    return response


async def get_result_from_response(ctx, response):
    if "response" in response and "result" in response["response"]:
        result = response["response"]["result"]
    else:
        await ctx.send("The apps script function seems to have returned garbage.")
        return

    return result


intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

XSERVER = 1100079094953156658
GUILD = discord.Object(id=XSERVER)


@bot.event
async def on_ready():
    await bot.tree.sync(guild=GUILD)
    logging.info(f"{bot.user.name} has connected to Discord!")


@bot.command(name="userid", description="Output User ID in Python", guild=GUILD)
async def userid(ctx: context):
    logging.info(ctx.author.id)


@bot.command(name="guildid")
async def guildid(ctx):
    logging.info(ctx.guild.id)


@bot.command(name="refreshtoken")
async def refresh_token(ctx: context):
    with open("token.json", "w") as token:
        token.write(" ".join(ctx.message.content.split()[1:]))


@bot.command(name="turn")
async def get_turn(ctx: context):
    spreadsheet_id, deployment_id, service = await make_google_service(
        ctx, "sheets", "v4"
    )

    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range="'Play area'!C1")
        .execute()
    )
    values = result.get("values", [])
    if not values:
        response = "No data found."
    else:
        response = values[0][0]
    await ctx.reply(response)


@bot.command(name="submit_card")
async def submit_card(ctx: context):
    await call_apps_script_function(
        ctx,
        function="button1",
        parameters=[
            ctx.message.content.split(" ", 1)[1],
            ctx.author.display_name,
            "Submit card",
            "SPREADSHEET_ID",
        ],
    )


@bot.command(name="submit_price")
async def submit_price(ctx: context):
    await call_apps_script_function(
        ctx,
        function="button1",
        parameters=[
            ctx.message.content.split(" ", 1)[1],
            ctx.author.display_name,
            "Submit festpreis",
            "SPREADSHEET_ID",
        ],
    )


@bot.command(name="buy_card")
async def buy_card(ctx: context):
    await call_apps_script_function(
        ctx,
        function="button1",
        parameters=["X", ctx.author.display_name, "Buy card", "SPREADSHEET_ID"],
    )


@bot.command(name="submit_second")
async def submit_second(ctx: context):
    await call_apps_script_function(
        ctx,
        function="button1",
        parameters=[
            ctx.message.content.split(" ", 1)[1],
            ctx.author.display_name,
            "Submit second card",
            "SPREADSHEET_ID",
        ],
    )


@bot.command(name="pass_card")
async def pass_card(ctx: context):
    await call_apps_script_function(
        ctx,
        function="button2",
        parameters=[ctx.author.display_name, "Pass on card", "SPREADSHEET_ID"],
    )


@bot.command(name="pass_second")
async def pass_second(ctx: context):
    await call_apps_script_function(
        ctx,
        function="passSecondInDouble",
        parameters=[ctx.author.display_name, "SPREADSHEET_ID"],
    )


@bot.command(name="open_bid")
async def open_bid(ctx: context):
    await call_apps_script_function(
        ctx,
        function="addBid",
        parameters=[
            ctx.author.display_name,
            ctx.message.content.split(" ", 1)[1],
            "Callsource - python",
            "SPREADSHEET_ID",
        ],
    )


@bot.command(name="bid")
async def bid(ctx: context):
    response = await call_apps_script_function(
        ctx,
        "sendCurrentState",
        ["SPREADSHEET_ID"]
    )

    state_dispatch = {
        1: "choose card for auction",
        2: once_around,
        3: submit_price,
        4: "second card after a double",
        5: open_bid,
        6: hidden_bid,
        7: buy_card,
        8: "end of game"
    }

    result = await get_result_from_response(ctx, response)

    logging.debug(result)

    function = state_dispatch[int(result)]

    if isinstance(function, str):
        await ctx.send("Error: " + function)
        return

    await function(ctx)
    

@bot.command(name="cash")
async def get_author_cash(ctx: context):
    response = await call_apps_script_function(
        ctx, "cashpackage", [ctx.author.display_name, "SPREADSHEET_ID"]
    )

    result = await get_result_from_response(ctx, response)

    await ctx.author.send(result)


@bot.command(name="hand")
async def get_author_hand(ctx: context):
    response = await call_apps_script_function(
        ctx, "handpackage", [ctx.author.display_name, "SPREADSHEET_ID"]
    )

    result = await get_result_from_response(ctx, response)

    image_links = result[1]
    xnumbers = result[0]

    with BytesIO() as image_binary:
        create_image(image_links, xnumbers).save(image_binary, "PNG")
        image_binary.seek(0)
        await ctx.author.send(file=discord.File(fp=image_binary, filename="image.png"))


@bot.command(name="channeltest")
async def get_channel_id(ctx: context):
    await ctx.send(ctx.channel.id)


# @bot.command(name='happybirthdayNick')
# async def get_channel_id(ctx: context):
#     await ctx.send("Happy birthday, Nick!")


@bot.command(name="hidden_bid")
async def hidden_bid(ctx: context):
    if get_instance_by_channel(ctx.channel.id) is None:
        await ctx.send("Please use this command in a game thread.")
        return

    await ctx.author.send("Please enter your bid:")

    def check(m):
        return m.author == ctx.author and isinstance(m.channel, discord.DMChannel)

    try:
        response = await bot.wait_for(
            "message", check=check, timeout=60
        )  # Wait for the user's response

        # Access the response and the original channel name
        user_response = response.content

    except asyncio.TimeoutError:
        await ctx.author.send("Response timeout. Please try again.")
        return

    await call_apps_script_function(
        ctx,
        "addBid",
        [
            ctx.author.display_name,
            user_response,
            "Callsource - python",
            "SPREADSHEET_ID",
        ],
    )


@bot.command(name="once_around")
async def once_around(ctx: context):
    await call_apps_script_function(
        ctx,
        "submitOnceAroundBid",
        [
            ctx.message.content.split(" ", 1)[1],
            ctx.author.display_name,
            "SPREADSHEET_ID",
        ],
    )


@bot.command(name="owned")
async def owned(ctx: context):
    response = await call_apps_script_function(ctx, "sendOwnedTable", ["SPREADSHEET_ID"])

    result = await get_result_from_response(ctx, response)

    for i in range(1, len(result[0])):
        result[0][i] = " ".join(result[0][i].splitlines())

    # Truncate to N characters if invoked as "!owned N"
    try:
        truncate = int(ctx.message.content.split()[1])
        result = [[str(cell)[:truncate] for cell in row] for row in result]
    except Exception:  # TODO: Be smarter
        pass

    asciitable = table2ascii(header=result[0], body=result[1:], first_col_heading=True)
    # print(asciitable)
    await ctx.send(f"```\n{asciitable}\n```")


abbrevs = {
    "HOYOS": "AH",
    "KRUMPÁR": "MK",
    "CONSTABLE": "JC",
    "WOU-KI": "WK",
    "BEKSIŃSKI": "ZB"
}

@bot.command(name="round")
async def submit_card_apps_script_function(ctx: context):
    response = await call_apps_script_function(ctx, "sendRoundTable", ["SPREADSHEET_ID"])

    result = await get_result_from_response(ctx, response)

    logging.debug(result)

    try:
        short = bool(ctx.message.content.split()[1])
    except Exception:
        short = False

    if short:
        for i in range(1, len(result)):
            result[i][0] = str(i)

    for i in range(1, len(result[0])):
        if not short:
            result[0][i] = result[0][i].replace("\n", " ")
        if short:
            for word, abbrev in abbrevs.items():
                result[0][i] = result[0][i].replace(word, abbrev)

    result[0][0] = f"R{result[0][0]}" if short else f"Round {result[0][0]}"
    asciitable = table2ascii(header=result[0], body=result[1:], first_col_heading=True)
    await ctx.send(f"```\n{asciitable}\n```")


@bot.command(name="halp")
async def print_help(ctx: context):
    message = "\r\n".join(
        [
            "**!halp:** Returns all of the commands and what they do.",
            "**!turn:** Returns a description of the current turn.",
            "**!owned:** Returns a table of the owned cards in this round.",
            "**!round:** Returns the round number and a table of past placements.",
            "**!hand:** Sends you your current hand as a direct message.",
            "**!cash:** Sends you your current cash as a direct message.",
            "**!submit_card XX:** Submits for auction card number XX.",
            "**!submit_second XX:** Submits for auction card number XX as the second of a double auction.",
            "**!pass_second:** Passes on choosing a second card in a double auction.",
            "**!submit_price XX:** Sets a festpreis XX.",
            "**!buy_card:** Buys a festpreis card.",
            "**!pass_card:** Passes on a festpreis card.",
            "**!open_bid XX:** Bids XX in an open auction.",
            "**!hidden_bid:** Asks you to provide a bid in the form XX in a direct message for a hidden auction.",
            "**!once_around XX:** Bids XX in a once-around auction.",
        ]
    )
    await ctx.send(message)


if __name__ == "__main__":
    bot.run(BOT_TOKEN)
