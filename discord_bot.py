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
from table2ascii import table2ascii #, Alignment, PresetStyle

from typing import TypeAlias

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
    logging.error("Apps Script execution error:" + "\n    " +\
                  # f'    Error message: {error["message"]}' + "\n    " + \
                  # f'    Error details: {error["details"]}' + "\n    " + \
                      "\n    ".join([f"{k}: {v}" for k, v in error_info["details"][0].items()]))
    if ctx is not None:
        await ctx.send(error_info["details"][0]["errorMessage"])


async def get_response(service, request, deployment_id, ctx):
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        await log_error_response(response, ctx)
    return response

async def call_google_function(ctx, function, parameters):
    """Calls FUNCTION on sheet determined by CTX with PARAMETERS.
    If the parameter is the context-sensitive spreadsheet_id,
    then use the special string SPREADSHEET_ID and it will be replaced with
    the appropriate value."""
    spreadsheet_id, deployment_id, service = await make_google_service(ctx)
    request = {'function': function, 'parameters': parameters}
    for i, parameter in enumerate(request['parameters']):
        if parameter == "SPREADSHEET_ID":
            request['parameters'][i] = str(spreadsheet_id)
    response = await get_response(service, request, deployment_id, ctx)
    return response


intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)


@bot.event
async def on_ready():
    print(f"{bot.user.name} has connected to Discord!")


@bot.command(name="userid")
async def userid(ctx: context):
    print(ctx.author.id)


@bot.command(name="refreshtoken")
async def refresh_token(ctx: context):
    with open("token.json", "w") as token:
        token.write(" ".join(ctx.message.content.split()[1:]))


@bot.command(name="turn")
async def run_apps_script_function(ctx: context):
    spreadsheet_id, deployment_id, service = await make_google_service(ctx,
                                                                     "sheets",
                                                                     "v4")

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
    await call_google_function(ctx,
                         function="button1",
                         parameters=[
                             ctx.message.content.split(" ", 1)[1],
                             ctx.author.display_name,
                             "Submit card",
                             "SPREADSHEET_ID"
                         ])


@bot.command(name="submit_price")
async def submit_price(ctx: context):
    await call_google_function(ctx,
                               function="button1",
                               parameters = [
                                   ctx.message.content.split(" ", 1)[1],
                                   ctx.author.display_name,
                                   "Submit festpreis",
                                   "SPREADSHEET_ID"
                               ])


@bot.command(name="buy_card")
async def buy_card(ctx: context):
    await call_google_function(ctx,
                               function="button1",
                               parameters=["X",
                                           ctx.author.display_name,
                                           "Buy card",
                                           "SPREADSHEET_ID"
                                           ])


@bot.command(name="submit_second")
async def submit_second(ctx: context):
    await call_google_function(ctx,
                               function="button1",
                               parameters=[
                                   ctx.message.content.split(" ", 1)[1],
                                   ctx.author.display_name,
                                   "Submit second card",
                                   "SPREADSHEET_ID",
                               ])


@bot.command(name="pass_card")
async def pass_card(ctx: context):
    await call_google_function(ctx,
                               function="button2",
                               parameters=[ctx.author.display_name,
                                           "Pass on card",
                                           "SPREADSHEET_ID"])


@bot.command(name="pass_second")
async def pass_second(ctx: context):
    await call_google_function(ctx,
                               function="passSecondInDouble",
                               parameters=[ctx.author.display_name,
                                           "SPREADSHEET_ID"])


@bot.command(name="open_bid")
async def open_bid(ctx: context):
    await call_google_function(
        ctx,
        function="addBid",
        parameters=[
            ctx.author.display_name,
            ctx.message.content.split(" ", 1)[1],
            "Callsource - python",
            "SPREADSHEET_ID",
        ])


@bot.command(name="cash")
async def get_author_cash(ctx: context):
    spreadsheet_id, deployment_id, service = await make_google_service(ctx)
    
    request = {
        "function": "cashpackage",
        "parameters": [ctx.author.display_name, str(spreadsheet_id)],
    }
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        error = response["error"]
        print("Apps Script execution error:")
        print(f'Error message: {error["message"]}')
        print(f'Error details: {error["details"]}')
        # You can handle the error or raise an exception as needed
        await ctx.send(error["message"][0]["errorMessage"])
        return

    elif "response" in response and "result" in response["response"]:
        result = response["response"]["result"]
        # print(result)
    else:
        await ctx.send("The apps script function seems to have returned garbage.")
        return

    # embed = discord.Embed(title='Image Gallery', color=discord.Color.blue())

    await ctx.author.send(result)


@bot.command(name="hand")
async def get_author_hand(ctx: context):
    spreadsheet_id, deployment_id, service = await make_google_service(ctx)
    
    request = {
        "function": "handpackage",
        "parameters": [ctx.author.display_name, str(spreadsheet_id)],
    }
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        await log_error_response(response, ctx)
        return

    elif "response" in response and "result" in response["response"]:
        result = response["response"]["result"]
        # print(result)
    else:
        await ctx.send("The apps script function seems to have returned garbage.")
        return

    # embed = discord.Embed(title='Image Gallery', color=discord.Color.blue())
    image_links = result[1]
    xnumbers = result[0]

    with BytesIO() as image_binary:
        create_image(image_links, xnumbers).save(image_binary, "PNG")
        image_binary.seek(0)
        await ctx.author.send(file=discord.File(fp=image_binary, filename="image.png"))

    # await author.send(embed=embed)
    # await ctx.send('Image gallery sent to your direct messages!')


@bot.command(name="channeltest")
async def get_channel_id(ctx: context):
    await ctx.send(ctx.channel.id)


# @bot.command(name='happybirthdayNick')
# async def get_channel_id(ctx: context):
#     await ctx.send("Happy birthday, Nick!")


@bot.command(name="hidden_bid")
async def hidden_bid(ctx: context):
    xinstance = get_instance_by_channel(ctx.channel.id)
    if xinstance is None:
        await ctx.send("Please use this command in a game thread.")
        return
    spreadsheet_id = xinstance[1]
    deployment_id = xinstance[2]
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

    spreadsheet_id, deployment_id, service = await make_google_service(ctx)

    # run the script function

    request = {
        "function": "addBid",
        "parameters": [
            ctx.author.display_name,
            user_response,
            "Callsource - python",
            str(spreadsheet_id),
        ],
    }
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        error = response["error"]
        print("Apps Script execution error:")
        print(f'Error message: {error["message"]}')
        print(f'Error details: {error["details"]}')
        # You can handle the error or raise an exception as needed
        await ctx.send(error["details"][0]["errorMessage"])


@bot.command(name="once_around")
async def once_around(ctx: context):
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
    service = build("script", "v1", credentials=creds)

    # run the script function

    request = {
        "function": "submitOnceAroundBid",
        "parameters": [
            ctx.message.content.split(" ", 1)[1],
            ctx.author.display_name,
            str(spreadsheet_id),
        ],
    }
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        error = response["error"]
        print("Apps Script execution error:")
        print(f'Error message: {error["message"]}')
        print(f'Error details: {error["details"]}')
        # You can handle the error or raise an exception as needed
        await ctx.send(error["details"][0]["errorMessage"])


@bot.command(name="owned")
async def owned(ctx: context):
 
    spreadsheet_id, deployment_id, service = await make_google_service(ctx)

    # run the script function

    request = {"function": "sendOwnedTable", "parameters": [str(spreadsheet_id)]}
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        error = response["error"]
        print("Apps Script execution error:")
        print(f'Error message: {error["message"]}')
        print(f'Error details: {error["details"]}')
        # You can handle the error or raise an exception as needed
        await ctx.send(error["details"][0]["errorMessage"])
    elif "response" in response and "result" in response["response"]:
        result = response["response"]["result"]
    else:
        await ctx.send("The apps script function seems to have returned garbage.")
        return

    logging.warn(result)

    for i in range(1, len(result[0])):
        result[0][i] = " ".join(result[0][i].splitlines())

    try:
        truncate = int(ctx.message.content.split()[1])
        result = [[str(cell)[:truncate] for cell in row] for row in result]
    except Exception: # TODO: Be smarter
        pass
        
    asciitable = table2ascii(header=result[0], body=result[1:], first_col_heading=True)
    # print(asciitable)
    await ctx.send(f"```\n{asciitable}\n```")


@bot.command(name="round")
async def submit_card_apps_script_function(ctx: context):
    spreadsheet_id, deployment_id, service = await make_google_service(ctx)

    # run the script function

    request = {"function": "sendRoundTable", "parameters": [str(spreadsheet_id)]}
    response = service.scripts().run(body=request, scriptId=deployment_id).execute()
    if "error" in response:
        error = response["error"]
        print("Apps Script execution error:")
        print(f'Error message: {error["message"]}')
        print(f'Error details: {error["details"]}')
        # You can handle the error or raise an exception as needed
        await ctx.send(error["details"][0]["errorMessage"])
    elif "response" in response and "result" in response["response"]:
        result = response["response"]["result"]
    else:
        await ctx.send("The apps script function seems to have returned garbage.")
        return
    for i in range(1, len(result[0])):
        result[0][i] = " ".join(result[0][i].splitlines())
    result[0][0] = "Round " + str(result[0][0])
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
